const fs = require("node:fs/promises");
const path = require("node:path");
const { hashPassword } = require("./auth");

async function migrate(pool) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(82004321)");
    await db.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())",
    );
    const dir = path.join(__dirname, "../db/migrations");
    for (const name of (await fs.readdir(dir))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      if (
        (
          await db.query("SELECT name FROM schema_migrations WHERE name=$1", [
            name,
          ])
        ).rowCount
      )
        continue;
      await db.query(await fs.readFile(path.join(dir, name), "utf8"));
      await db.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    }
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

async function seed(pool) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(82004322)");
    const passwordHash = await hashPassword("demo-password");
    const members = [];
    for (const [name, email, role] of [
      ["Alex Morgan", "alex@example.com", "Lead"],
      ["Priya Shah", "priya@example.com", "Engineer"],
      ["Jordan Lee", "jordan@example.com", "Engineer"],
    ]) {
      const result = await db.query(
        `INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,$3,$4)
        ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id`,
        [name, email, role, passwordHash],
      );
      members.push(result.rows[0].id);
    }
    // Seed only an empty incident table. Reruns never overwrite operator work.
    if (!(await db.query("SELECT id FROM incidents LIMIT 1")).rowCount) {
      const samples = [
        [
          "Checkout error rate above threshold",
          "HTTP 502 responses increased after the payment gateway rollout. Investigate upstream connection failures.",
          "SEV1",
          "In Progress",
          "Payments",
          0,
          25,
        ],
        [
          "Worker queue processing is delayed",
          "Provisioning jobs are accumulating. Compare consumer capacity and database latency before scaling.",
          "SEV2",
          "Open",
          "Provisioning",
          1,
          48,
        ],
        [
          "API latency elevated in the east region",
          "p95 latency is above the service objective. A recent query change is a hypothesis; capture telemetry to investigate.",
          "SEV2",
          "Mitigated",
          "Core API",
          2,
          90,
        ],
        [
          "Scheduled export missed its deadline",
          "The reporting export did not complete during its expected processing window.",
          "SEV3",
          "Open",
          "Analytics",
          null,
          120,
        ],
        [
          "Login redirect loop after config rollout",
          "The callback configuration was corrected and synthetic login checks now pass.",
          "SEV2",
          "Resolved",
          "Identity",
          1,
          180,
        ],
        [
          "Duplicate alert notifications",
          "Alert deduplication was restored. Review the routing rule before the next deploy.",
          "SEV4",
          "Resolved",
          "Observability",
          2,
          240,
        ],
      ];
      for (const [
        title,
        description,
        severity,
        status,
        service,
        owner,
        minutes,
      ] of samples) {
        const row = (
          await db.query(
            `INSERT INTO incidents(title,description,severity,status,service,assigned_to,created_at,resolved_at)
          VALUES($1,$2,$3,$4::varchar,$5,$6,now()-($7::int*interval '1 minute'),CASE WHEN $4::varchar='Resolved' THEN now()-interval '10 minutes' END) RETURNING id`,
            [
              title,
              description,
              severity,
              status,
              service,
              owner === null ? null : members[owner],
              minutes,
            ],
          )
        ).rows[0];
        await db.query(
          "INSERT INTO incident_events(incident_id,actor_id,kind,details) VALUES($1,$2,$3,$4)",
          [
            row.id,
            members[0],
            "created",
            JSON.stringify({ source: "Demo seed", synthetic: true }),
          ],
        );
        await db.query(
          "INSERT INTO status_history(incident_id,to_status,changed_by) VALUES($1,$2,$3)",
          [row.id, status, members[0]],
        );
      }
    }
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
module.exports = { migrate, seed };
