const { Pool } = require("pg");

if (process.env.CI) {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is required in CI");
  }
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 });
  pool.query("SELECT 1").then(() => pool.end()).catch(async (error) => {
    await pool.end().catch(() => undefined);
    throw error;
  });
}
