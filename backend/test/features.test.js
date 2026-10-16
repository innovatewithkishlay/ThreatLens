const test = require("node:test");
const assert = require("node:assert/strict");
const { traceFunds } = require("../app/utils/fundTracer");
const { nameSimilarity, screenAccounts } = require("../app/utils/screening");
const { resolveThresholds, diffFromDefaults } = require("../app/utils/thresholdSettings");
const { buildReport } = require("../app/utils/reportBuilder");
const { analyzeCase } = require("../app/utils/anomalyDetector");
const { inferType } = require("../app/services/watchlistService");

let n = 0;
const tx = (from, to, amount, date) => ({ _id: `t${++n}`, fromAccount: from, toAccount: to, amount, date: date ? new Date(`${date}Z`) : null });

test("forward trace follows funds in time order", () => {
  const txs = [
    tx("SRC", "M1", 1000, "2025-01-01T10:00:00"),
    tx("M1", "M2", 600, "2025-01-01T11:00:00"),
    tx("M1", "OTHER", 300, "2025-01-01T09:00:00"), // before funds arrived - not traced
    tx("M2", "END", 600, "2025-01-02T10:00:00"),
    tx("M1", "END2", 900, "2025-01-03T10:00:00"), // only 400 traced left at M1
  ];
  const r = traceFunds(txs, "SRC");
  assert.equal(r.totalTraced, 1000);
  const by = Object.fromEntries(r.nodes.map((x) => [x.account, x]));
  assert.equal(by.OTHER, undefined);
  assert.equal(by.END.retained, 600);
  assert.equal(by.END2.retained, 400);
  assert.equal(by.M1.retained, 0);
  assert.equal(by.END.hop, 3);
  assert.deepEqual(r.endpoints.map((e) => e.account), ["END", "END2"]);
});

test("backward trace finds the origin of funds", () => {
  const txs = [
    tx("A", "MID", 500, "2025-01-01T10:00:00"),
    tx("B", "MID", 500, "2025-01-01T10:30:00"),
    tx("MID", "TARGET", 800, "2025-01-01T12:00:00"),
    tx("C", "MID", 999, "2025-01-02T12:00:00"), // after - irrelevant
  ];
  const r = traceFunds(txs, "TARGET", { direction: "backward" });
  const by = Object.fromEntries(r.nodes.map((x) => [x.account, x]));
  assert.equal(r.totalTraced, 800);
  assert.equal(by.C, undefined);
  assert.equal(by.A.retained + by.B.retained, 800);
});

test("trace respects the hop limit", () => {
  const txs = [tx("S", "1", 10, "2025-01-01T01:00:00"), tx("1", "2", 10, "2025-01-01T02:00:00"), tx("2", "3", 10, "2025-01-01T03:00:00")];
  const r = traceFunds(txs, "S", { maxHops: 2 });
  assert.equal(r.depth, 2);
  assert.ok(!r.nodes.some((x) => x.account === "3"));
});

test("name similarity tolerates order, titles and typos", () => {
  assert.equal(nameSimilarity("John Smith", "Smith John"), 1);
  assert.ok(nameSimilarity("Mr. Jon Smith", "John Smith") >= 0.85);
  assert.ok(nameSimilarity("Acme Trading Ltd", "ACME TRADING") >= 0.95);
  assert.ok(nameSimilarity("John Smith", "Jane Doe") < 0.5);
});

test("screening matches identifiers exactly and names fuzzily", () => {
  const hits = screenAccounts(
    [
      { accountNumber: "acc 1", accountHolder: "Olga Petrova", metadata: { email: "X@Y.com", mobile: "+44 7000 000000" } },
      { accountNumber: "ACC2", accountHolder: "Somebody Else", metadata: {} },
    ],
    [
      { type: "email", value: "x@y.com" },
      { type: "phone", value: "0044 7000 000000" },
      { type: "name", value: "Olga Petrovaa" },
      { type: "account", value: "ACC1" },
    ]
  );
  const fields = hits.map((h) => h.field).sort();
  assert.deepEqual(fields, ["account", "accountHolder", "email", "mobile"]);
});

test("watchlist hits become critical findings", () => {
  const r = analyzeCase({
    transactions: [tx("BAD", "X", 10, "2025-01-01T10:00:00")],
    accounts: [{ accountNumber: "BAD", accountHolder: "Ivan Drago", metadata: {} }],
    watchlist: [{ type: "name", value: "Drago Ivan", note: "Sanctions list" }],
  });
  const f = r.findings.find((x) => x.type === "watchlist");
  assert.ok(f);
  assert.equal(f.severity, "critical");
  assert.match(f.description, /Sanctions list/);
});

test("threshold overrides are validated and clamped", () => {
  const t = resolveThresholds({ HIGH_VALUE: "20000", RAPID_SUCCESSIVE: { count: 0.4 }, HIGH_RISK_COUNTRIES: ["ng", "bad", "IR"], EVIL: 1 });
  assert.equal(t.HIGH_VALUE, 20000);
  assert.equal(t.RAPID_SUCCESSIVE.count, 2);
  assert.equal(t.RAPID_SUCCESSIVE.minutes, 10);
  assert.deepEqual(t.HIGH_RISK_COUNTRIES, ["NG", "IR"]);
  assert.equal(t.EVIL, undefined);
  assert.deepEqual(diffFromDefaults(resolveThresholds({})), null);
  assert.equal(diffFromDefaults(t).HIGH_VALUE, 20000);
});

test("lower thresholds produce more findings", () => {
  const txs = [tx("A", "B", 30000, "2025-01-01T10:00:00")];
  assert.equal(analyzeCase({ transactions: txs }).findings.length, 0);
  assert.equal(analyzeCase({ transactions: txs }, resolveThresholds({ HIGH_VALUE: 25000 })).findings.length, 1);
});

test("report covers who/what/where/how/why", () => {
  const transactions = [tx("A", "B", 90000, "2025-01-01T10:00:00"), tx("B", "A", 89000, "2025-01-02T10:00:00")];
  const analysis = analyzeCase({ transactions, accounts: [{ accountNumber: "A", accountHolder: "Alice", metadata: { email: "a@x.io" } }] });
  const report = buildReport(
    { caseId: "TL-1", name: "Test", riskScore: analysis.riskScore, riskLevel: analysis.riskLevel, analysis, stats: { transactionCount: 2, accountCount: 2, totalVolume: 179000, flaggedTransactions: 2, dateRange: { start: "2025-01-01", end: "2025-01-02" } } },
    [{ accountNumber: "A", accountHolder: "Alice", metadata: { email: "a@x.io" } }]
  );
  assert.deepEqual(report.sections.map((s) => s.key), ["summary", "who", "what", "where", "how", "why", "actions"]);
  assert.match(report.narrative, /Alice/);
  assert.match(report.narrative, /a@x\.io/);
  assert.match(report.narrative, /round-trip|Round-trip/i);
});

test("watchlist import infers entry types", () => {
  assert.equal(inferType("bad@guy.com"), "email");
  assert.equal(inferType("10.0.0.1"), "ip");
  assert.equal(inferType("+44 7700 900123"), "phone");
  assert.equal(inferType("ACC1015"), "account");
  assert.equal(inferType("Viktor Bout"), "name");
});

test("detects dormant account reactivation", () => {
  const r = analyzeCase({
    transactions: [
      tx("D", "X", 100, "2025-01-01T10:00:00"),
      tx("Y", "D", 20000, "2025-03-15T10:00:00"),
      tx("D", "Z", 19500, "2025-03-16T10:00:00"),
    ],
  });
  const f = r.findings.find((x) => x.type === "dormant");
  assert.ok(f);
  assert.deepEqual(f.subjects, ["D"]);
  assert.equal(f.meta.gapDays, 73);
});

test("detects transfers far outside an account's own pattern", () => {
  const txs = [];
  for (let i = 0; i < 8; i++) txs.push(tx("P", `R${i}`, 200 + i, `2025-01-0${i + 1}T10:00:00`));
  txs.push(tx("P", "BIG", 9000, "2025-01-09T10:00:00"));
  const f = analyzeCase({ transactions: txs }).findings.find((x) => x.type === "outlier");
  assert.ok(f);
  assert.equal(f.transactions.length, 1);
  assert.equal(f.meta.multiple, 44);
});

test("Benford test: natural data conforms, fabricated data does not", () => {
  const { benfordTest } = require("../app/utils/anomalyDetector");
  // Geometric sequence spanning orders of magnitude follows Benford.
  const natural = Array.from({ length: 1000 }, (_, i) => 10 * Math.pow(1.0093, i));
  const nat = benfordTest(natural, 300);
  assert.ok(nat.applicable);
  assert.ok(["close", "acceptable"].includes(nat.conformity), nat.conformity);
  // Fabricated: amounts clustered in 7,000-9,999
  const fake = Array.from({ length: 400 }, (_, i) => 7000 + ((i * 37) % 2999));
  const res = benfordTest(fake, 300);
  assert.equal(res.conformity, "nonconformity");
  const r = analyzeCase({ transactions: fake.map((a, i) => tx(`S${i % 20}`, `T${i}`, a, null)) });
  const f = r.findings.find((x) => x.type === "benford");
  assert.ok(f);
  assert.ok(f.meta.spikes.length > 0);
  assert.ok(r.benford.n === 400);
});
