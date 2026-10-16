const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeCase, findCycles } = require("../app/utils/anomalyDetector");

let n = 0;
const tx = (from, to, amount, date, extra = {}) => ({
  _id: `t${++n}`,
  fromAccount: from,
  toAccount: to,
  amount,
  date: date ? new Date(`${date}Z`) : null,
  ...extra,
});

const types = (result) => result.findings.map((f) => f.type);

test("clean data produces a low risk score", () => {
  const result = analyzeCase({
    transactions: [tx("A", "B", 120, "2025-01-01T10:00:00"), tx("B", "C", 80, "2025-01-02T11:00:00")],
  });
  assert.equal(result.findings.length, 0);
  assert.equal(result.riskLevel, "low");
  assert.equal(result.network.nodes.length, 3);
  assert.equal(result.network.edges.length, 2);
});

test("detects high value and structuring", () => {
  const result = analyzeCase({
    transactions: [
      tx("A", "B", 75000, "2025-01-01T10:00:00"),
      tx("C", "D", 9500, "2025-01-01T10:00:00"),
      tx("C", "E", 9900, "2025-01-02T10:00:00"),
    ],
  });
  assert.ok(types(result).includes("highValue"));
  const s = result.findings.find((f) => f.type === "structuring");
  assert.deepEqual(s.subjects, ["C"]);
  assert.equal(s.transactions.length, 2);
});

test("detects chronological circular flows only", () => {
  const ok = analyzeCase({
    transactions: [
      tx("A", "B", 50000, "2025-01-01T10:00:00"),
      tx("B", "C", 49000, "2025-01-01T12:00:00"),
      tx("C", "A", 48000, "2025-01-02T10:00:00"),
    ],
  });
  const circ = ok.findings.find((f) => f.type === "circular");
  assert.ok(circ);
  assert.deepEqual(circ.meta.path, ["A", "B", "C", "A"]);

  const backwards = analyzeCase({
    transactions: [
      tx("A", "B", 50000, "2025-01-03T10:00:00"),
      tx("B", "C", 49000, "2025-01-02T12:00:00"),
      tx("C", "A", 48000, "2025-01-01T10:00:00"),
    ],
  });
  assert.ok(!types(backwards).includes("circular"));
});

test("findCycles reports each cycle once", () => {
  const adj = new Map([
    ["A", new Set(["B"])],
    ["B", new Set(["C", "A"])],
    ["C", new Set(["A"])],
  ]);
  const cycles = findCycles(adj, { maxLength: 6, maxCycles: 50 });
  assert.equal(cycles.length, 2);
});

test("detects pass-through, fan-in and bursts", () => {
  const transactions = [
    tx("S", "M", 20000, "2025-01-01T10:00:00"),
    tx("M", "R", 19500, "2025-01-01T10:20:00"),
  ];
  for (let i = 0; i < 6; i++) transactions.push(tx(`P${i}`, "HUB", 900, `2025-01-02T1${i}:00:00`));
  for (let i = 0; i < 5; i++) transactions.push(tx("FAST", `Q${i % 2}`, 50, `2025-01-03T10:0${i}:00`));
  const result = analyzeCase({ transactions });
  const t = types(result);
  assert.ok(t.includes("passThrough"));
  assert.ok(t.includes("fanIn"));
  assert.ok(t.includes("rapidSuccession"));
  assert.equal(result.findings.find((f) => f.type === "fanIn").subjects[0], "HUB");
});

test("detects geography, off-hours, shared identity and new accounts", () => {
  const result = analyzeCase({
    transactions: [
      tx("A", "B", 100, "2025-01-01T02:00:00", { country: "IR" }),
      tx("N", "B", 30000, "2025-01-05T12:00:00"),
    ],
    accounts: [
      { accountNumber: "A", metadata: { email: "x@y.z" } },
      { accountNumber: "B", metadata: { email: "x@y.z" } },
      { accountNumber: "N", openedAt: new Date("2025-01-01T00:00:00Z"), metadata: {} },
    ],
  });
  const t = types(result);
  ["highRiskGeo", "unusualTime", "sharedIdentity", "newAccount"].forEach((k) => assert.ok(t.includes(k), k));
  assert.ok(result.geography.find((g) => g.country === "IR").highRisk);
});

test("flags reference real transaction ids", () => {
  const result = analyzeCase({ transactions: [tx("A", "B", 90000, "2025-01-01T10:00:00")] });
  const ids = Object.keys(result.flaggedTransactions);
  assert.equal(ids.length, 1);
  assert.deepEqual(result.flaggedTransactions[ids[0]], ["highValue"]);
});
