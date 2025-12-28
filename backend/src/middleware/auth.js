const jwt = require("jsonwebtoken");
const { getEnv } = require("../config/env");

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: "Missing token" });

  try {
    const secret = getEnv("JWT_SECRET", "");
    if (!secret) return res.status(500).json({ error: "Server misconfigured" });
    const payload = jwt.verify(match[1], secret);
    req.user = { id: Number(payload.sub), nickname: payload.nickname };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = { authMiddleware };

