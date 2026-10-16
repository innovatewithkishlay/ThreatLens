const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const mongoose = require("mongoose");
const request = require("supertest");
const { createApp } = require("../app");

const uri = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/threatlens_test";
const samples = path.resolve(__dirname, "../../frontend/public/samples");

let app;
let available = true;

test.before(async () => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
    await mongoose.connection.dropDatabase();
    app = createApp();
  } catch {
    available = false;
  }
});

test.after(async () => {
  if (available) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("API end-to-end", async (t) => {
  if (!available) return t.skip("MongoDB not available");

  const agent = request.agent(app);
  const other = request.agent(app);

  await t.test("health", async () => {
    const res = await agent.get("/api/health").expect(200);
    assert.equal(res.body.database, "connected");
  });

  let idA;
  let idB;
  await t.test("upload a case", async () => {
    const res = await agent
      .post("/api/cases")
      .attach("csvFile", path.join(samples, "sample-case-a.csv"))
      .expect(201);
    idA = res.body.id;
    assert.match(res.body.caseId, /^TL-\d{8}-[0-9A-F]{6}$/);
    assert.ok(res.body.riskScore > 50);
    const resB = await agent.post("/api/cases").attach("csvFile", path.join(samples, "sample-case-b.csv")).expect(201);
    idB = resB.body.id;
  });

  await t.test("rejects bad uploads", async () => {
    const res = await agent.post("/api/cases").attach("csvFile", Buffer.from("a,b\n1,2"), "bad.csv").expect(400);
    assert.match(res.body.error, /missing required columns/);
    await agent.post("/api/cases").expect(400);
    await agent.post("/api/cases").attach("csvFile", Buffer.from("x"), "evil.exe").expect(400);
  });

  await t.test("lists and fetches own cases", async () => {
    const list = await agent.get("/api/cases").expect(200);
    assert.equal(list.body.length, 2);
    const detail = await agent.get(`/api/cases/${idA}`).expect(200);
    assert.ok(detail.body.analysis.findings.length > 5);
    assert.ok(detail.body.accounts.length > 10);
    const txs = await agent.get(`/api/cases/${idA}/transactions`).expect(200);
    assert.equal(txs.body.length, fs.readFileSync(path.join(samples, "sample-case-a.csv"), "utf8").trim().split("\n").length - 1);
    assert.ok(txs.body.some((x) => x.isSuspicious));
  });

  await t.test("other visitors cannot see the case", async () => {
    const list = await other.get("/api/cases").expect(200);
    assert.equal(list.body.length, 0);
    await other.get(`/api/cases/${idA}`).expect(404);
    await other.delete(`/api/cases/${idA}`).expect(404);
  });

  await t.test("updates case and reviews transactions", async () => {
    const res = await agent.patch(`/api/cases/${idA}`).send({ status: "escalated", notes: "SAR filed", name: "Ring A" }).expect(200);
    assert.equal(res.body.status, "escalated");
    const txs = await agent.get(`/api/cases/${idA}/transactions`).expect(200);
    const reviewed = await agent.patch(`/api/cases/${idA}/transactions/${txs.body[0]._id}`).send({ status: "cleared" }).expect(200);
    assert.equal(reviewed.body.reviewStatus, "cleared");
    await other.patch(`/api/cases/${idA}/transactions/${txs.body[0]._id}`).send({ status: "cleared" }).expect(404);
    await agent.patch(`/api/cases/${idA}/transactions/${txs.body[0]._id}`).send({ status: "bogus" }).expect(400);
  });

  await t.test("compares cases", async () => {
    const res = await agent.get(`/api/cases/compare/${idA}/${idB}`).expect(200);
    const c = res.body.comparison;
    assert.ok(c.sharedAccounts.some((s) => s.account === "ACC1015"));
    assert.ok(c.sharedIdentifiers.length >= 1);
    assert.ok(c.crossCaseFlows.length >= 1);
    assert.ok(c.linkScore >= 50);
    await agent.get(`/api/cases/compare/${idA}/${idA}`).expect(400);
  });

  await t.test("exports", async () => {
    const csv = await agent.get(`/api/cases/${idA}/export?format=csv`).expect(200);
    assert.match(csv.headers["content-type"], /text\/csv/);
    assert.match(csv.text.split("\n")[0], /^reference,date,fromAccount/);
    const json = await agent.get(`/api/cases/${idA}/export?format=json`).expect(200);
    assert.equal(json.body.case.status, "escalated");
  });

  await t.test("pair upload", async () => {
    const res = await agent
      .post("/api/cases/pair")
      .attach("csvFiles", path.join(samples, "sample-case-a.csv"))
      .attach("csvFiles", path.join(samples, "sample-case-b.csv"))
      .expect(201);
    assert.ok(res.body.caseA && res.body.caseB);
  });

  await t.test("deletes", async () => {
    await agent.delete(`/api/cases/${idB}`).expect(204);
    await agent.get(`/api/cases/${idB}`).expect(404);
    await agent.get("/api/cases/not-an-id").expect(404);
  });

  await t.test("auth endpoints work without Google configured", async () => {
    const cfg = await agent.get("/auth/config").expect(200);
    assert.equal(cfg.body.googleEnabled, false);
    const me = await agent.get("/auth/me").expect(200);
    assert.equal(me.body.user, null);
    await agent.get("/api/nope").expect(404);
  });
});
