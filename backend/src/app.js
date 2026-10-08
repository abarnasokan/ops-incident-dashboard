const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { trace, SpanStatusCode } = require("@opentelemetry/api");
const { authMiddleware } = require("./auth");
const validate = require("./validation");
const users = require("./controllers/userController");
const incidents = require("./controllers/incidentController");
const { HttpError } = require("./http");
const { summarize } = require("./triage");

function createApp({
  pool,
  jwtSecret,
  allowLabFailures = false,
  staticDir = path.resolve(__dirname, "../../frontend/dist"),
}) {
  if (!jwtSecret || jwtSecret.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  const app = express();
  app.locals.pool = pool;
  app.locals.jwtSecret = jwtSecret;
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "64kb" }));
  app.use((req, res, next) => {
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      !req.is("application/json")
    )
      return res
        .status(415)
        .json({ message: "Use Content-Type: application/json." });
    next();
  });
  app.get("/health", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "connected" });
    } catch {
      res.status(503).json({ status: "unavailable", database: "unavailable" });
    }
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many sign-in attempts. Try again later." },
  });
  app.post(
    "/api/auth/register",
    authLimit,
    validate.register,
    users.createUser,
  );
  app.post("/api/auth/login", authLimit, validate.credentials, users.login);
  app.use("/api", authMiddleware(jwtSecret));
  app.use("/api", async (req, res, next) => {
    if (
      !(await pool.query("SELECT id FROM users WHERE id=$1", [req.actorId]))
        .rowCount
    )
      return res
        .status(401)
        .json({ message: "This account is no longer available." });
    next();
  });
  app.get("/api/auth/me", (req, res) => {
    req.params.id = String(req.actorId);
    return users.getUserById(req, res);
  });
  app.get("/api/config", (req, res) =>
    res.json({
      lab_failures: allowLabFailures,
      claude_configured: Boolean(
        process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL,
      ),
    }),
  );
  app.get("/api/metrics", incidents.metrics);
  app.use("/api/incidents", require("./routes/incidentRoutes"));
  app.use("/api/users", require("./routes/userRoutes"));
  app.post("/api/incidents/:id/summary", validate.id, summarize);
  app.post("/api/incidents/:id/lab-failure", validate.id, async (req, res) => {
    if (!allowLabFailures)
      throw new HttpError(
        403,
        "Lab failures are disabled in this environment.",
      );
    if (!["http_error", "slow_query"].includes(req.body.scenario))
      throw new HttpError(400, "Choose http_error or slow_query.");
    if (
      !(
        await pool.query(
          "SELECT id FROM incidents WHERE id=$1 AND archived_at IS NULL",
          [req.params.id],
        )
      ).rowCount
    )
      throw new HttpError(404, "Incident not found");
    const tracer = trace.getTracer("ops-incident-lab");
    return tracer.startActiveSpan("lab." + req.body.scenario, async (span) => {
      const started = performance.now();
      let message;
      try {
        if (req.body.scenario === "slow_query") {
          await pool.query("SELECT pg_sleep(0.3)");
          message =
            "Deliberate lab query delay: SELECT pg_sleep(0.3) completed.";
        } else {
          message = "Deliberate lab HTTP 500: injected request failure.";
          span.setStatus({ code: SpanStatusCode.ERROR, message });
          span.recordException(new Error(message));
        }
        const traceId = span.spanContext().traceId;
        const saved = (
          await pool.query(
            "INSERT INTO telemetry_events(incident_id,kind,trace_id,message,duration_ms) VALUES($1,$2,$3,$4,$5) RETURNING *",
            [
              req.params.id,
              req.body.scenario,
              /^0+$/.test(traceId) ? null : traceId,
              message,
              performance.now() - started,
            ],
          )
        ).rows[0];
        res
          .status(req.body.scenario === "http_error" ? 500 : 200)
          .json({ message, captured: true, evidence: saved });
      } finally {
        span.end();
      }
    });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ message: "API route not found" }),
  );
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get("/", (req, res) =>
      res.sendFile(path.join(staticDir, "index.html")),
    );
  } else
    app.get("/", (req, res) =>
      res.json({
        message:
          "API is ready. Run the React frontend or build it to serve the dashboard here.",
      }),
    );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error.status || 500,
      message = error.message;
    if (error.code === "23505") {
      status = 409;
      message = "An account with this email already exists.";
    } else if (error.code === "23503") {
      status = 400;
      message = "The selected user does not exist.";
    } else if (error.code === "23514") {
      status = 400;
      message = "The submitted data violates a database constraint.";
    }
    if (status >= 500) {
      console.error("Request failed:", error.code || error.name);
      message = "The request could not be completed.";
    }
    res.status(status).json({ message });
  });
  return app;
}
module.exports = { createApp };
