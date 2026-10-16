const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = "test";
process.env.COOKIE_SECRET = "test-secret";

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

  await t.test("investigation checklist", async () => {
    const c = await agent.get(`/api/cases/${idA}`).expect(200);
    assert.ok(c.body.checklist.length >= 5);
    assert.ok(c.body.checklist.every((x) => x.auto && !x.done));
    const list = c.body.checklist.map((x, i) => (i === 0 ? { ...x, done: true } : x));
    list.push({ text: "Call the bank's fraud desk", done: false });
    const res = await agent.patch(`/api/cases/${idA}`).send({ checklist: list }).expect(200);
    assert.equal(res.body.checklist[0].done, true);
    assert.ok(res.body.checklist[0].doneAt);
    assert.equal(res.body.checklist.at(-1).text, "Call the bank's fraud desk");
    assert.match(res.body.checklist.at(-1).key, /^custom-/);
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

  await t.test("fund tracing", async () => {
    const fwd = await agent.get(`/api/cases/${idA}/trace?account=ACC1002&direction=forward`).expect(200);
    assert.ok(fwd.body.nodes.some((n) => n.account === "ACC1015"));
    assert.ok(fwd.body.endpoints.length > 0);
    const back = await agent.get(`/api/cases/${idA}/trace?account=ACC1018&direction=backward`).expect(200);
    assert.ok(back.body.endpoints.some((n) => n.account.startsWith("ACC200")));
    await agent.get(`/api/cases/${idA}/trace?account=NOPE`).expect(404);
    await agent.get(`/api/cases/${idA}/trace`).expect(400);
    await other.get(`/api/cases/${idA}/trace?account=ACC1002`).expect(404);
  });

  await t.test("SAR report draft", async () => {
    const r = await agent.get(`/api/cases/${idA}/report`).expect(200);
    assert.ok(r.body.narrative.length > 500);
    assert.ok(r.body.subjects.length > 0);
    await agent.patch(`/api/cases/${idA}`).send({ reportDraft: "Edited narrative" }).expect(200);
    const again = await agent.get(`/api/cases/${idA}/report`).expect(200);
    assert.equal(again.body.draft, "Edited narrative");
  });

  await t.test("cross-case links and entity search", async () => {
    const links = await agent.get(`/api/cases/${idA}/links`).expect(200);
    assert.ok(links.body.length >= 1);
    assert.ok(links.body[0].matches.some((m) => m.kind === "account" && m.account === "ACC1015"));
    assert.ok(links.body[0].matches.some((m) => m.kind === "email"));
    const s = await agent.get(`/api/search?q=acc1015`).expect(200);
    assert.equal(s.body.entities[0].account, "ACC1015");
    assert.ok(s.body.entities[0].appearances.length >= 2);
    const none = await other.get(`/api/search?q=acc1015`).expect(200);
    assert.equal(none.body.entities.length, 0);
    const short = await agent.get(`/api/search?q=a`).expect(200);
    assert.equal(short.body.entities.length, 0);
    await agent.get(`/api/search?q=${encodeURIComponent("(.*[")}`).expect(200);
  });

  await t.test("watchlist screening and re-analysis", async () => {
    const before = await agent.get(`/api/cases/${idA}`).expect(200);
    assert.ok(!before.body.analysis.findings.some((f) => f.type === "watchlist"));
    const txs = await agent.get(`/api/cases/${idA}/transactions`).expect(200);
    const reviewedId = txs.body[0]._id;

    const add = await agent
      .post("/api/watchlist")
      .send({ entries: [{ value: "ACC1015", note: "Known mule" }, { value: "ACC1015" }, { value: "" }] })
      .expect(201);
    assert.deepEqual(add.body, { added: 1, skipped: 2 });
    const list = await agent.get("/api/watchlist").expect(200);
    assert.equal(list.body[0].type, "account");
    assert.equal((await other.get("/api/watchlist").expect(200)).body.length, 0);

    const re = await agent.post(`/api/cases/${idA}/reanalyze`).send({ thresholds: { HIGH_VALUE: 20000 } }).expect(200);
    assert.equal(re.body.checklist[0].done, true, "checklist progress survives re-analysis");
    assert.ok(re.body.checklist.some((x) => x.key === "watchlist"), "new tasks are added for new findings");
    assert.ok(re.body.analysis.findings.some((f) => f.type === "watchlist" && f.subjects[0] === "ACC1015"));
    assert.equal(re.body.settings.HIGH_VALUE, 20000);
    assert.ok(re.body.analysis.summary.byType.highValue > before.body.analysis.summary.byType.highValue);
    const after = await agent.get(`/api/cases/${idA}/transactions`).expect(200);
    assert.equal(after.body.find((x) => x._id === reviewedId).reviewStatus, "cleared");

    // Reset to defaults
    const reset = await agent.post(`/api/cases/${idA}/reanalyze`).send({ thresholds: null }).expect(200);
    assert.equal(reset.body.settings.HIGH_VALUE, 50000);

    await agent.delete(`/api/watchlist/${list.body[0]._id}`).expect(204);
    await other.delete(`/api/watchlist/${list.body[0]._id}`).expect(404);
  });

  await t.test("deletes", async () => {
    await agent.delete(`/api/cases/${idB}`).expect(204);
    await agent.get(`/api/cases/${idB}`).expect(404);
    await agent.get("/api/cases/not-an-id").expect(404);
  });

  await t.test("workspace keys share access without accounts", async () => {
    const mine = await agent.get("/api/workspace").expect(200);
    assert.match(mine.body.key, /^[a-f0-9-]{36}$/);
    assert.ok(mine.body.cases >= 1);
    // A teammate joins with the key and sees the same cases.
    const teammate = request.agent(app);
    await teammate.post("/api/workspace/join").send({ key: "nope" }).expect(400);
    const joined = await teammate.post("/api/workspace/join").send({ key: mine.body.key.toUpperCase() }).expect(200);
    assert.equal(joined.body.cases, mine.body.cases);
    assert.equal((await teammate.get("/api/cases").expect(200)).body.length, mine.body.cases);
    // Starting a fresh workspace hides them again.
    const fresh = await teammate.post("/api/workspace/new").expect(200);
    assert.notEqual(fresh.body.key, mine.body.key);
    assert.equal((await teammate.get("/api/cases").expect(200)).body.length, 0);
    // Forged cookies are ignored.
    const forged = await request(app).get("/api/cases").set("Cookie", `tl_workspace=${mine.body.key}`).expect(200);
    assert.equal(forged.body.length, 0);
    await agent.get("/api/nope").expect(404);
    await agent.get("/auth/google").expect((r) => assert.notEqual(r.status, 302));
  });
});
