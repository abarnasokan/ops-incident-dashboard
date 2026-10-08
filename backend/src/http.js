class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
async function transaction(pool, action) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const value = await action(db);
    await db.query("COMMIT");
    return value;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
async function event(db, incident, actor, kind, details = {}) {
  await db.query(
    "INSERT INTO incident_events(incident_id,actor_id,kind,details) VALUES($1,$2,$3,$4)",
    [incident, actor, kind, JSON.stringify(details)],
  );
}
module.exports = { HttpError, transaction, event };
