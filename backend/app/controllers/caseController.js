const service = require("../services/caseService");

const csvEscape = (v) => {
  if (v === undefined || v === null) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

exports.uploadCase = async (req, res) => {
  const file = req.file || req.files?.csvFile?.[0];
  if (!file) {
    return res.status(400).json({
      error: "No file uploaded. Please choose a CSV file.",
      details: ["Send the file in a multipart form field named \"csvFile\"."],
    });
  }
  const created = await service.createCaseFromCsv({
    buffer: file.buffer,
    filename: file.originalname,
    owner: req.owner,
    name: req.body?.name,
    description: req.body?.description,
  });
  res.status(201).json({
    id: created._id,
    caseId: created.caseId,
    name: created.name,
    riskScore: created.riskScore,
    riskLevel: created.riskLevel,
    stats: created.stats,
    warnings: created.warnings,
  });
};

exports.uploadPair = async (req, res) => {
  const files = req.files || [];
  if (files.length !== 2) {
    return res.status(400).json({ error: "Upload exactly two CSV files to compare." });
  }
  const created = [];
  for (const file of files) {
    created.push(
      await service.createCaseFromCsv({ buffer: file.buffer, filename: file.originalname, owner: req.owner })
    );
  }
  res.status(201).json({ caseA: created[0]._id, caseB: created[1]._id });
};

exports.listCases = async (req, res) => {
  res.json(await service.listCases(req.owner));
};

exports.getCase = async (req, res) => {
  res.json(await service.getCase(req.params.id, req.owner));
};

exports.getTransactions = async (req, res) => {
  res.json(await service.getTransactions(req.params.id, req.owner));
};

exports.updateCase = async (req, res) => {
  res.json(await service.updateCase(req.params.id, req.owner, req.body || {}));
};

exports.deleteCase = async (req, res) => {
  await service.deleteCase(req.params.id, req.owner);
  res.status(204).end();
};

exports.reviewTransaction = async (req, res) => {
  res.json(await service.reviewTransaction(req.params.txId, req.owner, req.body?.status));
};

exports.compareCases = async (req, res) => {
  const a = req.params.a || req.body?.caseA;
  const b = req.params.b || req.body?.caseB;
  if (!a || !b) return res.status(400).json({ error: "Two case ids are required." });
  res.json(await service.compare(a, b, req.owner));
};

exports.exportCase = async (req, res) => {
  const format = req.query.format === "json" ? "json" : "csv";
  const caseData = await service.getCase(req.params.id, req.owner);
  const transactions = await service.getTransactions(req.params.id, req.owner);
  const base = `${caseData.caseId}`;

  if (format === "json") {
    res.setHeader("Content-Disposition", `attachment; filename="${base}-report.json"`);
    return res.json({
      generatedAt: new Date().toISOString(),
      case: {
        caseId: caseData.caseId,
        name: caseData.name,
        status: caseData.status,
        notes: caseData.notes,
        sourceFile: caseData.sourceFile,
        riskScore: caseData.riskScore,
        riskLevel: caseData.riskLevel,
        stats: caseData.stats,
        createdAt: caseData.createdAt,
      },
      summary: caseData.analysis.summary,
      findings: caseData.analysis.findings,
      accounts: caseData.analysis.accountRisk,
      transactions,
    });
  }

  const header = ["reference", "date", "fromAccount", "toAccount", "amount", "currency", "country", "description", "suspicious", "flags", "reviewStatus"];
  const lines = [header.join(",")];
  for (const t of transactions) {
    lines.push(
      [t.reference, t.date, t.fromAccount, t.toAccount, t.amount, t.currency, t.country, t.description, t.isSuspicious ? "yes" : "no", (t.flags || []).join("|"), t.reviewStatus]
        .map(csvEscape)
        .join(",")
    );
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${base}-transactions.csv"`);
  res.send(lines.join("\n"));
};
