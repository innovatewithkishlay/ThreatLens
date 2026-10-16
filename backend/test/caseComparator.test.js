const test = require("node:test");
const assert = require("node:assert/strict");
const { compareCases, cosine } = require("../app/utils/caseComparator");

const mk = (name, transactions, accounts = []) => ({
  case: { _id: name, caseId: name, analysis: { summary: { byType: { highValue: 1 } }, accountRisk: [] } },
  transactions: transactions.map((t, i) => ({ _id: `${name}${i}`, ...t, date: new Date(t.date) })),
  accounts,
});

test("cosine similarity", () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([], [1]), 0);
});

test("finds shared accounts, identifiers and cross-case flows", () => {
  const a = mk(
    "A",
    [{ fromAccount: "X", toAccount: "MULE", amount: 5000, date: "2025-01-01T10:00:00Z", country: "NG" }],
    [{ accountNumber: "X", metadata: { email: "boss@evil.test" } }]
  );
  const b = mk(
    "B",
    [{ fromAccount: "MULE", toAccount: "Y", amount: 4900, date: "2025-01-01T12:00:00Z", country: "NG" }],
    [{ accountNumber: "Z", metadata: { email: "boss@evil.test" } }]
  );
  const result = compareCases(a, b);
  assert.deepEqual(result.sharedAccounts.map((s) => s.account), ["MULE"]);
  assert.equal(result.sharedIdentifiers.length, 1);
  assert.equal(result.crossCaseFlows.length, 1);
  assert.deepEqual(result.crossCaseFlows[0].path, ["X", "MULE", "Y"]);
  assert.equal(result.crossCaseFlows[0].gapHours, 2);
  assert.deepEqual(result.geography.commonHighRisk, ["NG"]);
  assert.ok(result.linkScore >= 50);
  assert.equal(result.network.nodes.find((n) => n.id === "MULE").membership, "both");
});

test("unrelated cases score low", () => {
  const a = mk("A", [{ fromAccount: "A1", toAccount: "A2", amount: 10, date: "2025-01-01T10:00:00Z" }]);
  const b = mk("B", [{ fromAccount: "B1", toAccount: "B2", amount: 10, date: "2026-01-01T10:00:00Z" }]);
  const result = compareCases(a, b);
  assert.equal(result.sharedAccounts.length, 0);
  assert.equal(result.temporal.overlap, null);
  assert.ok(result.linkScore < 25);
});
