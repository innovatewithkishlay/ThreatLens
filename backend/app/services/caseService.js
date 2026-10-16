const mongoose = require("mongoose");
const crypto = require("crypto");
const Case = require("../models/Case");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const { parseTransactionsCsv } = require("../utils/csvParser");
const { analyzeCase } = require("../utils/anomalyDetector");
const { compareCases } = require("../utils/caseComparator");
const { traceFunds } = require("../utils/fundTracer");
const { buildReport, buildChecklist } = require("../utils/reportBuilder");
const { resolveThresholds, diffFromDefaults } = require("../utils/thresholdSettings");
const WatchlistEntry = require("../models/WatchlistEntry");
const env = require("../../config/env");

const httpError = (status, message) => Object.assign(new Error(message), { status });

const newCaseId = () => {
  const d = new Date();
  const date = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `TL-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
};

const ownerFilter = (owner) => ({ "owner.kind": owner.kind, "owner.id": owner.id });

const loadWatchlist = (owner) => WatchlistEntry.find(ownerFilter(owner), { type: 1, value: 1, note: 1 }).lean();

// Persisted subset of the detector output.
const analysisFields = (analysis, columns) => ({
  summary: analysis.summary,
  findings: analysis.findings,
  accountRisk: analysis.accountRisk,
  network: analysis.network,
  activity: analysis.activity,
  geography: analysis.geography,
  benford: analysis.benford,
  thresholds: analysis.thresholds,
  ...(columns ? { columns } : {}),
});

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
  const watchlist = await loadWatchlist(owner);
  const analysis = analyzeCase({ transactions, accounts: parsed.accounts, watchlist });

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
    analysis: analysisFields(analysis, parsed.columns),
    checklist: buildChecklist(analysis).map((c) => ({ ...c, done: false, auto: true })),
    analyzedAt: new Date(),
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
  checklist: 1,
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
  return { ...doc, accounts, settings: resolveThresholds(doc.thresholds) };
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
  if (typeof patch.reportDraft === "string") allowed.reportDraft = patch.reportDraft.slice(0, 50000);
  if (Array.isArray(patch.checklist)) {
    if (patch.checklist.length > 100) throw httpError(400, "A checklist can have at most 100 items.");
    allowed.checklist = patch.checklist
      .filter((c) => c && typeof c.text === "string" && c.text.trim())
      .map((c, i) => ({
        key: String(c.key || `custom-${Date.now()}-${i}`).slice(0, 60),
        text: c.text.trim().slice(0, 300),
        done: Boolean(c.done),
        auto: Boolean(c.auto),
        doneAt: c.done ? (c.doneAt ? new Date(c.doneAt) : new Date()) : undefined,
      }));
  }
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

/**
 * Re-run detection on a stored case, optionally with new thresholds and the
 * current watchlist. Investigator review decisions are preserved.
 */
const reanalyzeCase = async (id, owner, { thresholds } = {}) => {
  const doc = await findOwnedCase(id, owner, { _id: 1, thresholds: 1, stats: 1, checklist: 1 });
  const resolved = resolveThresholds(thresholds !== undefined ? thresholds : doc.thresholds);
  const [transactions, accounts, watchlist] = await Promise.all([
    Transaction.find({ caseId: doc._id }, { reviewStatus: 0, caseId: 0, __v: 0 }).lean(),
    Account.find({ caseId: doc._id }, { accountNumber: 1, accountHolder: 1, accountType: 1, openedAt: 1, country: 1, metadata: 1 }).lean(),
    loadWatchlist(owner),
  ]);
  const analysis = analyzeCase({ transactions, accounts, watchlist }, resolved);
  const prev = await Case.findById(doc._id, { "analysis.columns": 1 }).lean();

  await Case.updateOne(
    { _id: doc._id },
    {
      $set: {
        analysis: analysisFields(analysis, prev?.analysis?.columns),
        riskScore: analysis.riskScore,
        riskLevel: analysis.riskLevel,
        "stats.flaggedTransactions": analysis.summary.flaggedTransactions,
        thresholds: diffFromDefaults(resolved),
        // Add tasks for newly detected patterns, keep existing progress.
        checklist: [
          ...(doc.checklist || []),
          ...buildChecklist(analysis)
            .filter((c) => !(doc.checklist || []).some((x) => x.key === c.key))
            .map((c) => ({ ...c, done: false, auto: true })),
        ],
        analyzedAt: new Date(),
      },
    }
  );

  const flagged = analysis.flaggedTransactions;
  const txOps = transactions
    .map((t) => {
      const flags = flagged[String(t._id)] || [];
      const changed = Boolean(t.isSuspicious) !== flags.length > 0 || (t.flags || []).join() !== flags.join();
      return changed ? { updateOne: { filter: { _id: t._id }, update: { $set: { isSuspicious: flags.length > 0, flags } } } } : null;
    })
    .filter(Boolean);
  for (let i = 0; i < txOps.length; i += 5000) await Transaction.bulkWrite(txOps.slice(i, i + 5000), { ordered: false });

  const acctOps = analysis.accountRisk.map((r) => ({
    updateOne: {
      filter: { caseId: doc._id, accountNumber: r.account },
      update: { $set: { riskScore: r.score, riskLevel: r.level, reasons: r.reasons } },
    },
  }));
  if (acctOps.length) await Account.bulkWrite(acctOps, { ordered: false });

  return getCase(id, owner);
};

const traceCase = async (id, owner, { account, direction, hops }) => {
  if (!account) throw httpError(400, "Choose an account to trace.");
  const doc = await findOwnedCase(id, owner, { _id: 1, "analysis.accountRisk": 1 });
  const transactions = await Transaction.find({ caseId: doc._id }, { fromAccount: 1, toAccount: 1, amount: 1, date: 1, row: 1 }).lean();
  if (!transactions.some((t) => t.fromAccount === account || t.toAccount === account)) {
    throw httpError(404, `Account ${account} does not appear in this case.`);
  }
  const maxHops = Math.min(10, Math.max(1, Number(hops) || 6));
  const result = traceFunds(transactions, account, { direction: direction === "backward" ? "backward" : "forward", maxHops });
  const risk = new Map((doc.analysis?.accountRisk || []).map((r) => [r.account, r]));
  result.nodes = result.nodes.map((n) => ({ ...n, score: risk.get(n.account)?.score || 0, level: risk.get(n.account)?.level || "low", holder: risk.get(n.account)?.holder }));
  result.endpoints = result.endpoints.map((n) => result.nodes.find((x) => x.account === n.account));
  return result;
};

const reportForCase = async (id, owner) => {
  const doc = await findOwnedCase(id, owner);
  const accounts = await Account.find({ caseId: doc._id }, { accountNumber: 1, accountHolder: 1, accountType: 1, country: 1, metadata: 1 }).lean();
  const report = buildReport(doc, accounts);
  return { ...report, status: doc.status, notes: doc.notes, draft: doc.reportDraft || "" };
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Accounts and identifiers of this case that also appear in the owner's other cases. */
const crossCaseLinks = async (id, owner) => {
  const doc = await findOwnedCase(id, owner, { _id: 1 });
  const others = await Case.find({ ...ownerFilter(owner), _id: { $ne: doc._id } }, { caseId: 1, name: 1, riskScore: 1, riskLevel: 1, createdAt: 1 }).lean();
  if (!others.length) return [];
  const mine = await Account.find({ caseId: doc._id }, { accountNumber: 1, metadata: 1 }).lean();
  const values = (f) => [...new Set(mine.map((a) => a.metadata?.[f]).filter(Boolean))];
  const numbers = mine.map((a) => a.accountNumber);
  const theirs = await Account.find(
    {
      caseId: { $in: others.map((o) => o._id) },
      $or: [
        { accountNumber: { $in: numbers } },
        { "metadata.email": { $in: values("email") } },
        { "metadata.mobile": { $in: values("mobile") } },
        { "metadata.ipAddress": { $in: values("ipAddress") } },
      ],
    },
    { caseId: 1, accountNumber: 1, metadata: 1, riskScore: 1 }
  ).limit(2000).lean();

  const byNumber = new Map(mine.map((a) => [a.accountNumber, a]));
  const byField = (f) => {
    const m = new Map();
    mine.forEach((a) => a.metadata?.[f] && m.set(a.metadata[f], a.accountNumber));
    return m;
  };
  const fieldMaps = { email: byField("email"), mobile: byField("mobile"), ipAddress: byField("ipAddress") };
  const grouped = new Map();
  for (const t of theirs) {
    const key = String(t.caseId);
    if (!grouped.has(key)) grouped.set(key, []);
    const matches = grouped.get(key);
    if (byNumber.has(t.accountNumber)) matches.push({ kind: "account", account: t.accountNumber, otherAccount: t.accountNumber, value: t.accountNumber });
    for (const [f, m] of Object.entries(fieldMaps)) {
      const v = t.metadata?.[f];
      if (v && m.has(v) && m.get(v) !== t.accountNumber) matches.push({ kind: f, account: m.get(v), otherAccount: t.accountNumber, value: v });
    }
  }
  return others
    .filter((o) => grouped.get(String(o._id))?.length)
    .map((o) => ({ case: o, matches: grouped.get(String(o._id)).slice(0, 50) }))
    .sort((a, b) => b.matches.length - a.matches.length);
};

/** Search accounts, holders and identifiers across all of the owner's cases. */
const searchEntities = async (owner, rawQuery) => {
  const q = String(rawQuery || "").trim().slice(0, 100);
  if (q.length < 2) return { query: q, entities: [], cases: [] };
  const cases = await Case.find(ownerFilter(owner), { caseId: 1, name: 1, riskScore: 1, riskLevel: 1, createdAt: 1 }).lean();
  const caseById = new Map(cases.map((c) => [String(c._id), c]));
  const rx = new RegExp(escapeRegex(q), "i");
  const digits = q.replace(/[^\d]/g, "");
  const accounts = await Account.find(
    {
      caseId: { $in: cases.map((c) => c._id) },
      $or: [
        { accountNumber: rx },
        { accountHolder: rx },
        { "metadata.email": rx },
        { "metadata.ipAddress": rx },
        ...(digits.length >= 4 ? [{ "metadata.mobile": new RegExp(escapeRegex(digits)) }] : []),
      ],
    },
    { caseId: 1, accountNumber: 1, accountHolder: 1, metadata: 1, riskScore: 1, riskLevel: 1, stats: 1 }
  ).limit(300).lean();

  const entities = new Map();
  for (const a of accounts) {
    const e = entities.get(a.accountNumber) || { account: a.accountNumber, holder: a.accountHolder, maxScore: 0, appearances: [] };
    e.holder = e.holder || a.accountHolder;
    e.maxScore = Math.max(e.maxScore, a.riskScore || 0);
    const c = caseById.get(String(a.caseId));
    if (c) e.appearances.push({ caseId: String(c._id), caseRef: c.caseId, caseName: c.name, score: a.riskScore || 0, level: a.riskLevel, email: a.metadata?.email, mobile: a.metadata?.mobile, ipAddress: a.metadata?.ipAddress, inflow: a.stats?.inflow, outflow: a.stats?.outflow });
    entities.set(a.accountNumber, e);
  }
  const matchingCases = cases.filter((c) => rx.test(c.name || "") || rx.test(c.caseId)).slice(0, 10);
  return {
    query: q,
    entities: [...entities.values()].sort((a, b) => b.appearances.length - a.appearances.length || b.maxScore - a.maxScore).slice(0, 50),
    cases: matchingCases,
  };
};

module.exports = {
  createCaseFromCsv,
  listCases,
  getCase,
  getTransactions,
  updateCase,
  deleteCase,
  reviewTransaction,
  compare,
  reanalyzeCase,
  traceCase,
  reportForCase,
  crossCaseLinks,
  searchEntities,
  ownerFilter,
  httpError,
};
