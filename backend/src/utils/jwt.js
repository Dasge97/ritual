const jwt = require("jsonwebtoken");
const { getEnv } = require("../config/env");

function signToken(user) {
  const secret = getEnv("JWT_SECRET", "");
  const expiresIn = getEnv("JWT_EXPIRES_IN", "7d");
  return jwt.sign({ nickname: user.nickname }, secret, { subject: String(user.id), expiresIn });
}

module.exports = { signToken };

