const mysql = require("mysql2/promise");
const { getEnv } = require("./env");

let pool;

function getPool() {
  if (!pool) throw new Error("DB not initialized");
  return pool;
}

async function initDb() {
  const host = getEnv("DB_HOST", "mysql");
  const port = Number(getEnv("DB_PORT", "3306"));
  const user = getEnv("DB_USER", "app");
  const password = getEnv("DB_PASSWORD", "apppass");
  const database = getEnv("DB_NAME", "ritual");

  // Comentario en espaÃ±ol: Reintentos bÃ¡sicos porque MySQL puede tardar en iniciar en Docker.
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        timezone: "Z"
      });
      await pool.query("SELECT 1");
      console.log("[backend] DB connected");
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function withTransaction(fn) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { initDb, getPool, withTransaction };


