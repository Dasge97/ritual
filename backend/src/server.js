require("dotenv").config();

const { createApp } = require("./app");
const { initDb } = require("./config/db");

async function main() {
  await initDb();
  const app = createApp();
  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    // Comentario en español: Log mínimo para confirmar que el servidor está arriba.
    console.log(`[backend] listening on :${port}`);
  });
}

main().catch((err) => {
  console.error("[backend] fatal error", err);
  process.exit(1);
});

