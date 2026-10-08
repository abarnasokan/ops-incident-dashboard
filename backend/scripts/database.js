require("dotenv").config();
const pool = require("../src/config/db");
const { migrate, seed } = require("../src/dbTasks");
(async () => {
  try {
    await migrate(pool);
    if (process.argv.includes("--seed")) await seed(pool);
    console.log("Database setup complete.");
  } catch (error) {
    console.error("Database setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
