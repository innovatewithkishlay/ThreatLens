const test = require("node:test");
const assert = require("node:assert/strict");
const { parseTransactionsCsv, parseAmount, parseDate } = require("../app/utils/csvParser");

test("parseAmount handles currency symbols and separators", () => {
  assert.equal(parseAmount("$1,234.50"), 1234.5);
  assert.equal(parseAmount("1.234,50"), 1234.5);
  assert.equal(parseAmount("  9500 "), 9500);
  assert.equal(parseAmount("(250)"), -250);
  assert.ok(Number.isNaN(parseAmount("abc")));
});

test("parseDate keeps wall-clock time as UTC", () => {
  assert.equal(parseDate("2025-06-01T02:30:00").toISOString(), "2025-06-01T02:30:00.000Z");
  assert.equal(parseDate("2025-06-01").toISOString(), "2025-06-01T00:00:00.000Z");
  assert.equal(parseDate("15/06/2025 10:05").toISOString(), "2025-06-15T10:05:00.000Z");
  assert.equal(parseDate(""), null);
  assert.equal(parseDate("not a date"), undefined);
});

test("parses flexible headers and skips invalid rows", async () => {
  const csv = [
    "Sender,Beneficiary,Amount,Timestamp,Country",
    "A1,B1,\"1,500.00\",2025-06-01 10:00,gb",
    "A1,,200,2025-06-01,GB",
    "",
    "A2,B2,abc,2025-06-02,US",
    "A3,B3,99.99,,US",
  ].join("\n");
  const result = await parseTransactionsCsv(Buffer.from(csv));
  assert.equal(result.transactions.length, 2);
  assert.equal(result.transactions[0].amount, 1500);
  assert.equal(result.transactions[0].country, "GB");
  assert.equal(result.transactions[1].date, null);
  assert.equal(result.skipped, 3);
  assert.equal(result.errors.length, 2);
});

test("supports semicolon separated files with BOM", async () => {
  const csv = "﻿fromAccount;toAccount;amount\nX;Y;10\n";
  const result = await parseTransactionsCsv(Buffer.from(csv));
  assert.equal(result.transactions.length, 1);
});

test("rejects files missing required columns", async () => {
  await assert.rejects(parseTransactionsCsv(Buffer.from("foo,bar\n1,2\n")), (err) => {
    assert.equal(err.status, 400);
    assert.match(err.message, /missing required columns/);
    assert.equal(err.details.length, 3);
    return true;
  });
});

test("rejects empty files", async () => {
  await assert.rejects(parseTransactionsCsv(Buffer.from("  \n")), /empty/);
});
