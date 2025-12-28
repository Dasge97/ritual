const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { authMiddleware } = require("./middleware/auth");
const authRoutes = require("./routes/authRoutes");
const groupRoutes = require("./routes/groupRoutes");
const thingRoutes = require("./routes/thingRoutes");
const ritualRoutes = require("./routes/ritualRoutes");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: false
    })
  );

  app.use(express.json({ limit: "1mb" }));

  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);

  // Comentario en español: Todo lo demás está protegido por JWT.
  app.use("/api", authMiddleware);
  app.use("/api/groups", groupRoutes);
  app.use("/api", thingRoutes);
  app.use("/api", ritualRoutes);

  app.use((err, _req, res, _next) => {
    const status = Number(err?.statusCode || err?.status || 500);
    const message =
      status >= 500
        ? "Internal server error"
        : err?.message || "Request failed";

    if (status >= 500) console.error("[backend] request error", err);
    return res.status(status).json({ error: message });
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  return app;
}

module.exports = { createApp };
