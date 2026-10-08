const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Pool } = require("pg");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/app");
const { migrate, seed } = require("../src/dbTasks");
const { rules, validOutput } = require("../src/triage");
const { hashPassword, verifyPassword } = require("../src/auth");
const secret = "test-only-secret-at-least-32-characters-long";
const url =
  process.env.TEST_DATABASE_URL ||
  "postgres://ops_demo:local-demo-password@127.0.0.1:55432/ops_dashboard_test";
if (!new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "Tests require a dedicated database whose name ends in _test.",
  );
const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 3000 });
const app = createApp({ pool, jwtSecret: secret, allowLabFailures: true });
let token, actor;
const auth = () => ({ Authorization: "Bearer " + token });
async function makeIncident(extra = {}) {
  const r = await request(app)
    .post("/api/incidents")
    .set(auth())
    .send({
      title: "Test incident " + crypto.randomUUID(),
      description: "Observed test issue",
      severity: "SEV2",
      service: "Test service",
      ...extra,
    });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}
before(async () => {
  await migrate(pool);
  await seed(pool);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "alex@example.com", password: "demo-password" });
  assert.equal(login.status, 200);
  token = login.body.token;
  actor = login.body.user;
});
after(() => pool.end());

test("migrations and seeding can run again without changing operator records", async () => {
  const before = await pool.query("SELECT count(*) FROM incidents");
  await migrate(pool);
  await seed(pool);
  assert.equal(
    (await pool.query("SELECT count(*) FROM incidents")).rows[0].count,
    before.rows[0].count,
  );
  assert.equal(
    (await pool.query("SELECT count(*) FROM schema_migrations")).rows[0].count,
    "1",
  );
});
test("health verifies the database and reports unavailable connections", async () => {
  assert.equal((await request(app).get("/health")).status, 200);
  const offline = createApp({
    pool: {
      query: async () => {
        throw new Error("offline");
      },
    },
    jwtSecret: secret,
  });
  assert.equal((await request(offline).get("/health")).status, 503);
});
test("private API routes require a valid unexpired JWT", async () => {
  assert.equal((await request(app).get("/api/incidents")).status, 401);
  assert.equal(
    (
      await request(app)
        .get("/api/incidents")
        .set("Authorization", "Bearer bad-token")
    ).status,
    401,
  );
  const expired = jwt.sign({}, secret, {
    subject: String(actor.id),
    issuer: "ops-incident-dashboard",
    audience: "ops-dashboard",
    expiresIn: -1,
  });
  assert.equal(
    (
      await request(app)
        .get("/api/incidents")
        .set("Authorization", "Bearer " + expired)
    ).status,
    401,
  );
});
test("user responses never expose password hashes", async () => {
  const r = await request(app).get("/api/users").set(auth());
  assert.equal(r.status, 200);
  assert.ok(r.body.every((u) => !Object.hasOwn(u, "password_hash")));
  const me = await request(app).get("/api/auth/me").set(auth());
  assert.equal(me.body.id, actor.id);
  assert.ok(!me.body.password_hash);
});
test("signup validates credentials, normalizes email, and rejects duplicate addresses", async () => {
  assert.equal(
    (
      await request(app)
        .post("/api/auth/register")
        .send({ name: " ", email: "bad", password: "short" })
    ).status,
    400,
  );
  const email = "test-" + crypto.randomUUID() + "@example.com";
  const r = await request(app).post("/api/auth/register").send({
    name: "Test Operator",
    email: email.toUpperCase(),
    password: "valid-test-password",
    role: "Lead",
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.email, email);
  assert.equal(r.body.user.role, "Engineer");
  assert.ok(r.body.token);
  assert.equal(
    (
      await request(app)
        .post("/api/auth/register")
        .send({ name: "Duplicate", email, password: "valid-test-password" })
    ).status,
    409,
  );
});
test("wrong credentials return a clear sign-in failure", async () => {
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .send({ email: "alex@example.com", password: "wrong-password" })
    ).status,
    401,
  );
});
test("password hashing uses different salts and verifies safely", async () => {
  const a = await hashPassword("example-password"),
    b = await hashPassword("example-password");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("example-password", a), true);
  assert.equal(await verifyPassword("wrong-password", a), false);
});
test("empty, malformed, and wrongly typed bodies are rejected", async () => {
  assert.equal(
    (
      await request(app)
        .post("/api/incidents")
        .set(auth())
        .send({ title: " ", description: "x", severity: "SEV9" })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/incidents")
        .set(auth())
        .set("Content-Type", "application/json")
        .send("{bad")
    ).status,
    400,
  );
  assert.equal(
    (await request(app).post("/api/incidents").set(auth()).send("text")).status,
    415,
  );
});
test("new incidents start Open with actor-attributed history", async () => {
  const row = await makeIncident();
  assert.equal(row.status, "Open");
  assert.equal(row.version, 1);
  const detail = (
    await request(app)
      .get("/api/incidents/" + row.id)
      .set(auth())
  ).body;
  assert.equal(detail.history[0].changed_by, actor.id);
  assert.equal(detail.activity[0].kind, "created");
  assert.equal(
    (
      await request(app).post("/api/incidents").set(auth()).send({
        title: "bad",
        description: "bad",
        severity: "SEV2",
        status: "Resolved",
      })
    ).status,
    400,
  );
});
test("invalid IDs, filters, and foreign-key owners are rejected", async () => {
  assert.equal(
    (await request(app).get("/api/incidents/xyz").set(auth())).status,
    400,
  );
  assert.equal(
    (await request(app).get("/api/incidents/2147483647").set(auth())).status,
    404,
  );
  assert.equal(
    (await request(app).get("/api/incidents?severity=bad").set(auth())).status,
    400,
  );
  assert.equal(
    (
      await request(app).post("/api/incidents").set(auth()).send({
        title: "bad owner",
        description: "test",
        severity: "SEV2",
        assigned_to: 2147483647,
      })
    ).status,
    400,
  );
});
test("search, status filters, pagination, and SQL-looking text remain safe", async () => {
  const marker = "unique-" + crypto.randomUUID();
  const row = await makeIncident({ title: marker });
  const found = await request(app)
    .get("/api/incidents")
    .query({ q: marker, status: "Open", limit: 1, page: 1 })
    .set(auth());
  assert.equal(found.body.total, 1);
  assert.equal(found.body.items[0].id, row.id);
  const none = await request(app)
    .get("/api/incidents")
    .query({ q: "' OR 1=1 --" })
    .set(auth());
  assert.equal(none.body.total, 0);
});
test("updates require a version and valid severity or status", async () => {
  const row = await makeIncident();
  assert.equal(
    (
      await request(app)
        .patch("/api/incidents/" + row.id)
        .set(auth())
        .send({ status: "Resolved" })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .patch("/api/incidents/" + row.id)
        .set(auth())
        .send({ version: 1, severity: "bad" })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .patch("/api/incidents/" + row.id)
        .set(auth())
        .send({ version: 1, status: "bad" })
    ).status,
    400,
  );
});
test("concurrent writers cannot overwrite one another", async () => {
  const row = await makeIncident();
  const results = await Promise.all(
    ["first", "second"].map((title) =>
      request(app)
        .patch("/api/incidents/" + row.id)
        .set(auth())
        .send({ title, version: row.version }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});
test("resolution timestamps survive detail edits and clear on reopening", async () => {
  const row = await makeIncident();
  const resolved = (
    await request(app)
      .patch("/api/incidents/" + row.id)
      .set(auth())
      .send({ status: "Resolved", version: 1 })
  ).body;
  assert.ok(resolved.resolved_at);
  const edited = (
    await request(app)
      .patch("/api/incidents/" + row.id)
      .set(auth())
      .send({ title: "Resolved details edited", version: resolved.version })
  ).body;
  assert.equal(edited.resolved_at, resolved.resolved_at);
  const reopened = (
    await request(app)
      .patch("/api/incidents/" + row.id)
      .set(auth())
      .send({ status: "Open", version: edited.version })
  ).body;
  assert.equal(reopened.resolved_at, null);
});
test("unsupported transitions are refused without an audit side effect", async () => {
  const row = await makeIncident();
  const r = await request(app)
    .patch("/api/incidents/" + row.id)
    .set(auth())
    .send({ status: "Mitigated", version: 1 });
  assert.equal(r.status, 409);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*) FROM incident_events WHERE incident_id=$1",
        [row.id],
      )
    ).rows[0].count,
    "1",
  );
});
test("comments are attributed to the authenticated actor and validate empty notes", async () => {
  const row = await makeIncident();
  assert.equal(
    (
      await request(app)
        .post("/api/incidents/" + row.id + "/comments")
        .set(auth())
        .send({ body: " " })
    ).status,
    400,
  );
  const note = await request(app)
    .post("/api/incidents/" + row.id + "/comments")
    .set(auth())
    .send({ body: "Investigated worker logs.", author_id: 999 });
  assert.equal(note.status, 201);
  assert.equal(note.body.author_id, actor.id);
});
test("archiving retains history and removes the incident from active views", async () => {
  const row = await makeIncident();
  const archive = await request(app)
    .delete("/api/incidents/" + row.id)
    .set(auth())
    .send({});
  assert.equal(archive.status, 200);
  assert.equal(
    (
      await request(app)
        .get("/api/incidents/" + row.id)
        .set(auth())
    ).status,
    404,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*) FROM incident_events WHERE incident_id=$1",
        [row.id],
      )
    ).rows[0].count,
    "2",
  );
});
test("metrics change with the actual persisted incident lifecycle", async () => {
  const before = (await request(app).get("/api/metrics").set(auth())).body;
  const row = await makeIncident({ severity: "SEV1" });
  const after = (await request(app).get("/api/metrics").set(auth())).body;
  assert.equal(after.active, before.active + 1);
  assert.equal(after.critical, before.critical + 1);
  await request(app)
    .patch("/api/incidents/" + row.id)
    .set(auth())
    .send({ status: "Resolved", version: 1 });
  const resolved = (await request(app).get("/api/metrics").set(auth())).body;
  assert.equal(resolved.active, before.active);
  assert.equal(resolved.critical, before.critical);
});
test("lab events are real request observations and slow query time is measured", async () => {
  const row = await makeIncident();
  const failure = await request(app)
    .post("/api/incidents/" + row.id + "/lab-failure")
    .set(auth())
    .send({ scenario: "http_error" });
  assert.equal(failure.status, 500);
  assert.equal(failure.body.captured, true);
  const slow = await request(app)
    .post("/api/incidents/" + row.id + "/lab-failure")
    .set(auth())
    .send({ scenario: "slow_query" });
  assert.equal(slow.status, 200);
  assert.ok(slow.body.evidence.duration_ms >= 250);
  const report = await request(app)
    .post("/api/incidents/" + row.id + "/summary")
    .set(auth())
    .send({ provider: "rules" });
  assert.equal(report.status, 200);
  assert.equal(report.body.provider, "rules");
  assert.equal(report.body.evidence.length, 2);
  assert.equal(report.body.evidence_ids.length, 2);
});
test("lab injection must be enabled explicitly", async () => {
  const disabled = createApp({
    pool,
    jwtSecret: secret,
    allowLabFailures: false,
  });
  const row = await makeIncident();
  assert.equal(
    (
      await request(disabled)
        .post("/api/incidents/" + row.id + "/lab-failure")
        .set(auth())
        .send({ scenario: "http_error" })
    ).status,
    403,
  );
});
test("rule reports do not invent a hypothesis without evidence", () => {
  assert.equal(rules([]).confidence, "low");
  assert.deepEqual(rules([]).evidence_ids, []);
});
test("provider reports must cite real evidence IDs and match the output contract", () => {
  const evidence = [{ id: 7, kind: "http_error" }];
  const report = rules(evidence);
  assert.equal(validOutput(report, evidence), true);
  assert.equal(
    validOutput({ ...report, evidence_ids: [999] }, evidence),
    false,
  );
  assert.equal(
    validOutput({ ...report, next_steps: "execute anything" }, evidence),
    false,
  );
});

test("Claude requests send only captured evidence and reject invalid provider responses", async (t) => {
  const oldKey = process.env.ANTHROPIC_API_KEY;
  const oldModel = process.env.ANTHROPIC_MODEL;
  process.env.ANTHROPIC_API_KEY = "test-only-provider-key";
  process.env.ANTHROPIC_MODEL = "test-only-model";
  t.after(() => {
    for (const [key, value] of [
      ["ANTHROPIC_API_KEY", oldKey],
      ["ANTHROPIC_MODEL", oldModel],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const row = await makeIncident({
    description: "PRIVATE INCIDENT DESCRIPTION",
  });
  await request(app)
    .post(`/api/incidents/${row.id}/comments`)
    .set(auth())
    .send({ body: "PRIVATE RESPONSE NOTE" });
  await request(app)
    .post(`/api/incidents/${row.id}/lab-failure`)
    .set(auth())
    .send({ scenario: "slow_query" });
  let sent,
    invalid = false,
    unavailable = false;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    sent = JSON.parse(options.body);
    const evidence = JSON.parse(sent.messages[0].content).evidence;
    const report = rules(evidence);
    if (invalid) report.evidence_ids = [999999999];
    return {
      ok: !unavailable,
      json: async () => ({
        content: [
          { type: "tool_use", name: "report_hypothesis", input: report },
        ],
      }),
    };
  });
  const run = () =>
    request(app)
      .post(`/api/incidents/${row.id}/summary`)
      .set(auth())
      .send({ provider: "claude" });
  const valid = await run();
  assert.equal(valid.status, 200);
  assert.equal(valid.body.provider, "claude");
  assert.equal(JSON.stringify(sent).includes("PRIVATE"), false);
  assert.equal(JSON.stringify(sent).includes(actor.email), false);
  invalid = true;
  assert.equal((await run()).status, 502);
  unavailable = true;
  assert.equal((await run()).status, 502);
});
