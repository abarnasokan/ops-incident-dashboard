require("dotenv").config();
const telemetry = require("./instrumentation");
const pool = require("./config/db");
const { createApp } = require("./app");
const { migrate, seed } = require("./dbTasks");
async function main() {
  if (process.env.AUTO_MIGRATE === "true") await migrate(pool);
  if (process.env.DEMO_SEED === "true") await seed(pool);
  const app = createApp({
    pool,
    jwtSecret: process.env.JWT_SECRET,
    allowLabFailures: process.env.ALLOW_LAB_FAILURES === "true",
  });
  const server = app.listen(
    Number(process.env.PORT || 5001),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        "Ops Incident Dashboard listening on port " +
          (process.env.PORT || 5001),
      ),
  );
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    const timer = setTimeout(() => process.exit(1), 10000);
    timer.unref();
    server.close(async () => {
      await pool.end();
      await telemetry.shutdown();
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
main().catch((error) => {
  console.error("Startup failed:", error.message);
  process.exit(1);
});
