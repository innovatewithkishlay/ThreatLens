const mongoose = require("mongoose");
const crypto = require("crypto");
const Case = require("../models/Case");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const { parseTransactionsCsv } = require("../utils/csvParser");
const { analyzeCase } = require("../utils/anomalyDetector");
const { compareCases } = require("../utils/caseComparator");
const env = require("../../config/env");

const httpError = (status, message) => Object.assign(new Error(message), { status });

const newCaseId = () => {
  const d = new Date();
  const date = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `TL-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
};

const ownerFilter = (owner) => ({ "owner.kind": owner.kind, "owner.id": owner.id });

const findOwnedCase = async (id, owner, projection) => {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, "Case not found.");
  const doc = await Case.findOne({ _id: id, ...ownerFilter(owner) }, projection).lean();
  if (!doc) throw httpError(404, "Case not found.");
  return doc;
};

/**
 * Parse, analyse and persist a CSV file as a new case.
 */
const createCaseFromCsv = async ({ buffer, filename, owner, name, description }) => {
  const parsed = await parseTransactionsCsv(buffer, { maxRows: env.maxRows });

  const transactions = parsed.transactions.map((t) => ({ ...t, _id: new mongoose.Types.ObjectId() }));
  const analysis = analyzeCase({ transactions, accounts: parsed.accounts });

  const caseObjectId = new mongoose.Types.ObjectId();
  const dates = transactions.filter((t) => t.date).map((t) => t.date.getTime());
  const totalVolume = transactions.reduce((s, t) => s + t.amount, 0);

  const warnings = [];
  if (parsed.skipped) warnings.push(`${parsed.skipped} row${parsed.skipped > 1 ? "s were" : " was"} skipped because of missing or invalid values.`);
  warnings.push(...parsed.errors.slice(0, 10));
  if (!parsed.columns.date) warnings.push("No date column found - time-based detections were skipped.");
  if (!parsed.columns.country) warnings.push("No country column found - geographic risk could not be assessed.");

  const caseDoc = {
    _id: caseObjectId,
    caseId: newCaseId(),
    name: (name || filename?.replace(/\.csv$/i, "") || "Untitled case").slice(0, 120),
    description: description?.slice(0, 2000),
    owner,
    sourceFile: filename,
    stats: {
      transactionCount: transactions.length,
      accountCount: analysis.accountRisk.length,
      totalVolume: Math.round(totalVolume * 100) / 100,
      averageAmount: Math.round((totalVolume / transactions.length) * 100) / 100,
      maxAmount: Math.max(...transactions.map((t) => t.amount)),
      currency: parsed.currency,
      dateRange: dates.length ? { start: new Date(Math.min(...dates)), end: new Date(Math.max(...dates)) } : undefined,
      skippedRows: parsed.skipped,
      flaggedTransactions: analysis.summary.flaggedTransactions,
    },
    riskScore: analysis.riskScore,
    riskLevel: analysis.riskLevel,
    analysis: {
      summary: analysis.summary,
      findings: analysis.findings,
      accountRisk: analysis.accountRisk,
      network: analysis.network,
      activity: analysis.activity,
      geography: analysis.geography,
      thresholds: analysis.thresholds,
      columns: parsed.columns,
    },
    warnings,
  };

  const riskByAccount = new Map(analysis.accountRisk.map((a) => [a.account, a]));
  const knownAccounts = new Map(parsed.accounts.map((a) => [a.accountNumber, a]));
  const accountDocs = analysis.accountRisk.map((r) => {
    const a = knownAccounts.get(r.account) || { accountNumber: r.account, metadata: {} };
    return {
      caseId: caseObjectId,
      accountNumber: r.account,
      accountHolder: a.accountHolder,
      accountType: a.accountType,
      openedAt: a.openedAt,
      country: a.country || r.country,
      metadata: a.metadata,
      stats: { inflow: r.inflow, outflow: r.outflow, sent: r.sent, received: r.received },
      riskScore: riskByAccount.get(r.account)?.score || 0,
      riskLevel: riskByAccount.get(r.account)?.level || "low",
      reasons: r.reasons,
    };
  });

  const flagged = new Map(Object.entries(analysis.flaggedTransactions));
  const txDocs = transactions.map((t) => ({
    ...t,
    caseId: caseObjectId,
    isSuspicious: flagged.has(String(t._id)),
    flags: flagged.get(String(t._id)) || [],
  }));

  try {
    await Case.create(caseDoc);
    await Account.insertMany(accountDocs, { ordered: false });
    for (let i = 0; i < txDocs.length; i += 5000) {
      await Transaction.insertMany(txDocs.slice(i, i + 5000), { ordered: false });
    }
  } catch (err) {
    await Promise.allSettled([
      Case.deleteOne({ _id: caseObjectId }),
      Account.deleteMany({ caseId: caseObjectId }),
      Transaction.deleteMany({ caseId: caseObjectId }),
    ]);
    throw err;
  }

  return caseDoc;
};

const summaryProjection = {
  caseId: 1,
  name: 1,
  description: 1,
  sourceFile: 1,
  status: 1,
  stats: 1,
  riskScore: 1,
  riskLevel: 1,
  createdAt: 1,
  updatedAt: 1,
  "analysis.summary": 1,
};

const listCases = (owner) =>
  Case.find(ownerFilter(owner), summaryProjection).sort({ createdAt: -1 }).limit(500).lean();

const getCase = async (id, owner) => {
  const doc = await findOwnedCase(id, owner);
  const accounts = await Account.find({ caseId: doc._id }, { caseId: 0, __v: 0 }).lean();
  return { ...doc, accounts };
};

const getTransactions = async (id, owner) => {
  const doc = await findOwnedCase(id, owner, { _id: 1 });
  return Transaction.find({ caseId: doc._id }, { caseId: 0, __v: 0 }).sort({ date: 1, row: 1 }).lean();
};

const updateCase = async (id, owner, patch) => {
  const allowed = {};
  if (typeof patch.name === "string") allowed.name = patch.name.trim().slice(0, 120) || "Untitled case";
  if (typeof patch.description === "string") allowed.description = patch.description.slice(0, 2000);
  if (typeof patch.notes === "string") allowed.notes = patch.notes.slice(0, 10000);
  if (["open", "investigating", "escalated", "closed"].includes(patch.status)) allowed.status = patch.status;
  if (!Object.keys(allowed).length) throw httpError(400, "Nothing to update.");
  await findOwnedCase(id, owner, { _id: 1 });
  return Case.findByIdAndUpdate(id, { $set: allowed }, { new: true, projection: summaryProjection }).lean();
};

const deleteCase = async (id, owner) => {
  const doc = await findOwnedCase(id, owner, { _id: 1 });
  await Promise.all([
    Case.deleteOne({ _id: doc._id }),
    Account.deleteMany({ caseId: doc._id }),
    Transaction.deleteMany({ caseId: doc._id }),
  ]);
};

const reviewTransaction = async (txId, owner, status) => {
  if (!["unreviewed", "suspicious", "cleared"].includes(status)) {
    throw httpError(400, "Status must be one of: unreviewed, suspicious, cleared.");
  }
  if (!mongoose.isValidObjectId(txId)) throw httpError(404, "Transaction not found.");
  const tx = await Transaction.findById(txId, { caseId: 1 }).lean();
  if (!tx) throw httpError(404, "Transaction not found.");
  await findOwnedCase(tx.caseId, owner, { _id: 1 });
  return Transaction.findByIdAndUpdate(txId, { $set: { reviewStatus: status } }, { new: true, projection: { caseId: 0, __v: 0 } }).lean();
};

const loadForComparison = async (id, owner) => {
  const doc = await findOwnedCase(id, owner, { caseId: 1, name: 1, analysis: 1, stats: 1, riskScore: 1, riskLevel: 1, createdAt: 1 });
  const [accounts, transactions] = await Promise.all([
    Account.find({ caseId: doc._id }, { accountNumber: 1, metadata: 1 }).lean(),
    Transaction.find({ caseId: doc._id }, { fromAccount: 1, toAccount: 1, amount: 1, date: 1, country: 1 }).lean(),
  ]);
  return { case: doc, accounts, transactions };
};

const compare = async (idA, idB, owner) => {
  if (String(idA) === String(idB)) throw httpError(400, "Choose two different cases to compare.");
  const [a, b] = await Promise.all([loadForComparison(idA, owner), loadForComparison(idB, owner)]);
  const strip = (c) => ({
    _id: c.case._id,
    caseId: c.case.caseId,
    name: c.case.name,
    riskScore: c.case.riskScore,
    riskLevel: c.case.riskLevel,
    stats: c.case.stats,
    createdAt: c.case.createdAt,
  });
  return { caseA: strip(a), caseB: strip(b), comparison: compareCases(a, b) };
};

const claimGuestCases = (guestId, userId) =>
  Case.updateMany(
    { "owner.kind": "guest", "owner.id": guestId },
    { $set: { owner: { kind: "user", id: String(userId) } } }
  );

module.exports = {
  createCaseFromCsv,
  listCases,
  getCase,
  getTransactions,
  updateCase,
  deleteCase,
  reviewTransaction,
  compare,
  claimGuestCases,
  httpError,
};
