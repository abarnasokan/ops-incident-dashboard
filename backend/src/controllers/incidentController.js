const { HttpError, transaction, event } = require("../http");
const transitions = {
  Open: ["In Progress", "Resolved"],
  "In Progress": ["Open", "Mitigated", "Resolved"],
  Mitigated: ["In Progress", "Resolved"],
  Resolved: ["Open"],
};
const selectIncident = `SELECT i.*, u.name AS assigned_name FROM incidents i LEFT JOIN users u ON u.id=i.assigned_to`;
async function getIncidents(req, res) {
  const values = [],
    where = ["i.archived_at IS NULL"];
  for (const [key, column] of [
    ["status", "status"],
    ["severity", "severity"],
    ["assigned_to", "assigned_to"],
  ]) {
    if (req.query[key]) {
      values.push(req.query[key]);
      where.push(`i.${column}=$${values.length}`);
    }
  }
  if (req.query.q) {
    values.push(`%${req.query.q}%`);
    where.push(
      `(i.title ILIKE $${values.length} OR i.service ILIKE $${values.length})`,
    );
  }
  const clause = where.join(" AND "),
    page = Number(req.query.page || 1),
    limit = Number(req.query.limit || 20);
  const result = await req.app.locals.pool.query(
    `WITH filtered AS (${selectIncident} WHERE ${clause}),
    items AS (SELECT * FROM filtered ORDER BY CASE severity WHEN 'SEV1' THEN 1 WHEN 'SEV2' THEN 2 WHEN 'SEV3' THEN 3 ELSE 4 END, created_at DESC, id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2})
    SELECT (SELECT count(*)::int FROM filtered) AS total, COALESCE((SELECT json_agg(items) FROM items),'[]') AS items`,
    [...values, limit, (page - 1) * limit],
  );
  res.json({ ...result.rows[0], page, limit });
}
async function getIncidentById(req, res) {
  const pool = req.app.locals.pool;
  const incident = (
    await pool.query(
      `${selectIncident} WHERE i.id=$1 AND i.archived_at IS NULL`,
      [req.params.id],
    )
  ).rows[0];
  if (!incident) throw new HttpError(404, "Incident not found");
  const [comments, history, activity, telemetry] = await Promise.all([
    pool.query(
      "SELECT c.*,u.name AS author_name FROM comments c JOIN users u ON u.id=c.author_id WHERE incident_id=$1 ORDER BY c.id",
      [incident.id],
    ),
    pool.query(
      "SELECT h.*,u.name AS actor_name FROM status_history h JOIN users u ON u.id=h.changed_by WHERE incident_id=$1 ORDER BY h.id",
      [incident.id],
    ),
    pool.query(
      "SELECT e.*,u.name AS actor_name FROM incident_events e JOIN users u ON u.id=e.actor_id WHERE incident_id=$1 ORDER BY e.id DESC",
      [incident.id],
    ),
    pool.query(
      "SELECT * FROM telemetry_events WHERE incident_id=$1 ORDER BY id DESC LIMIT 20",
      [incident.id],
    ),
  ]);
  res.json({
    ...incident,
    comments: comments.rows,
    history: history.rows,
    activity: activity.rows,
    telemetry: telemetry.rows,
  });
}
async function createIncident(req, res) {
  const {
    title,
    description,
    severity,
    category = "Application",
    service = "Unspecified",
    assigned_to = null,
  } = req.body;
  if (req.body.status && req.body.status !== "Open")
    throw new HttpError(400, "New incidents start Open.");
  const result = await transaction(req.app.locals.pool, async (db) => {
    const row = (
      await db.query(
        `INSERT INTO incidents(title,description,severity,category,service,assigned_to)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [title, description, severity, category, service, assigned_to],
      )
    ).rows[0];
    await event(db, row.id, req.actorId, "created");
    await db.query(
      "INSERT INTO status_history(incident_id,to_status,changed_by) VALUES($1,$2,$3)",
      [row.id, "Open", req.actorId],
    );
    return row;
  });
  res.status(201).json(result);
}
async function updateIncident(req, res) {
  const result = await transaction(req.app.locals.pool, async (db) => {
    const current = (
      await db.query(
        "SELECT * FROM incidents WHERE id=$1 AND archived_at IS NULL FOR UPDATE",
        [req.params.id],
      )
    ).rows[0];
    if (!current) throw new HttpError(404, "Incident not found");
    if (Number(req.body.version) !== current.version)
      throw new HttpError(
        409,
        "This incident changed. Refresh it before saving again.",
      );
    const fields = [
        "title",
        "description",
        "severity",
        "status",
        "category",
        "service",
        "assigned_to",
      ],
      next = { ...current };
    for (const field of fields)
      if (req.body[field] !== undefined) next[field] = req.body[field];
    if (next.assigned_to !== null) next.assigned_to = Number(next.assigned_to);
    if (
      next.status !== current.status &&
      !transitions[current.status].includes(next.status)
    )
      throw new HttpError(
        409,
        `Cannot change ${current.status} directly to ${next.status}.`,
      );
    const changes = {};
    for (const field of fields)
      if (current[field] !== next[field])
        changes[field] = { from: current[field], to: next[field] };
    if (!Object.keys(changes).length) return current;
    const row = (
      await db.query(
        `UPDATE incidents SET title=$1,description=$2,severity=$3,status=$4::varchar,category=$5,service=$6,assigned_to=$7,
      version=version+1,updated_at=now(),resolved_at=CASE WHEN $4::varchar='Resolved' THEN COALESCE(resolved_at,now()) ELSE NULL END
      WHERE id=$8 RETURNING *`,
        fields.map((f) => next[f]).concat(current.id),
      )
    ).rows[0];
    await event(db, row.id, req.actorId, "updated", changes);
    if (next.status !== current.status)
      await db.query(
        "INSERT INTO status_history(incident_id,from_status,to_status,changed_by) VALUES($1,$2,$3,$4)",
        [row.id, current.status, next.status, req.actorId],
      );
    return row;
  });
  res.json(result);
}
async function deleteIncident(req, res) {
  const row = await transaction(req.app.locals.pool, async (db) => {
    const value = (
      await db.query(
        "UPDATE incidents SET archived_at=now(),version=version+1,updated_at=now() WHERE id=$1 AND archived_at IS NULL RETURNING id",
        [req.params.id],
      )
    ).rows[0];
    if (!value) throw new HttpError(404, "Incident not found");
    await event(db, value.id, req.actorId, "archived");
    return value;
  });
  res.json({
    message: "Incident archived. Its history is retained.",
    id: row.id,
  });
}
async function addComment(req, res) {
  const row = await transaction(req.app.locals.pool, async (db) => {
    if (
      !(
        await db.query(
          "SELECT id FROM incidents WHERE id=$1 AND archived_at IS NULL FOR UPDATE",
          [req.params.id],
        )
      ).rowCount
    )
      throw new HttpError(404, "Incident not found");
    const value = (
      await db.query(
        "INSERT INTO comments(incident_id,author_id,body) VALUES($1,$2,$3) RETURNING *",
        [req.params.id, req.actorId, req.body.body],
      )
    ).rows[0];
    await event(db, req.params.id, req.actorId, "commented", {
      comment_id: value.id,
    });
    return value;
  });
  res.status(201).json(row);
}
async function metrics(req, res) {
  const result = await req.app.locals.pool.query(`SELECT count(*)::int AS total,
    count(*) FILTER(WHERE status!='Resolved')::int AS active,
    count(*) FILTER(WHERE severity='SEV1' AND status!='Resolved')::int AS critical,
    count(*) FILTER(WHERE assigned_to IS NULL AND status!='Resolved')::int AS unassigned,
    count(*) FILTER(WHERE status='Resolved')::int AS resolved,
    round((avg(EXTRACT(EPOCH FROM (resolved_at-created_at))/60) FILTER(WHERE status='Resolved'))::numeric,1) AS mean_resolution_minutes
    FROM incidents WHERE archived_at IS NULL`);
  res.json(result.rows[0]);
}
module.exports = {
  getIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  deleteIncident,
  addComment,
  metrics,
  transitions,
};
