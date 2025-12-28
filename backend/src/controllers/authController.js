const path = require("path");
const { getPool } = require("../config/db");
const { signToken } = require("../utils/jwt");
const { hashPassword, verifyPassword } = require("../utils/password");
const {
  z,
  emailSchema,
  nicknameSchema,
  nameSchema,
  passwordSchema
} = require("../utils/validation");
const { badRequest } = require("../utils/httpErrors");

function publicUser(userRow) {
  return {
    id: userRow.id,
    name: userRow.name,
    nickname: userRow.nickname,
    email: userRow.email,
    avatarUrl: userRow.avatar_url || null,
    createdAt: userRow.created_at
  };
}

async function register(req, res) {
  const schema = z.object({
    name: nameSchema,
    nickname: nicknameSchema,
    email: emailSchema,
    password: passwordSchema,
    avatarUrl: z.string().url().max(1024).optional().nullable()
  });

  const parsed = schema.safeParse({
    name: req.body?.name,
    nickname: req.body?.nickname,
    email: req.body?.email,
    password: req.body?.password,
    avatarUrl: req.body?.avatarUrl || null
  });
  if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());

  let avatarUrl = parsed.data.avatarUrl || null;
  if (req.file) {
    avatarUrl = `/uploads/${path.basename(req.file.filename)}`;
  }

  const pool = getPool();
  const [[existing]] = await pool.query(
    "SELECT id FROM users WHERE email = ? OR nickname = ? LIMIT 1",
    [parsed.data.email, parsed.data.nickname]
  );
  if (existing) return badRequest(res, "Email or nickname already in use");

  const passwordHash = await hashPassword(parsed.data.password);
  const [result] = await pool.query(
    "INSERT INTO users (name, nickname, email, avatar_url, password_hash) VALUES (?, ?, ?, ?, ?)",
    [parsed.data.name, parsed.data.nickname, parsed.data.email, avatarUrl, passwordHash]
  );

  const [[user]] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
  const token = signToken(user);
  return res.status(201).json({ token, user: publicUser(user) });
}

async function login(req, res) {
  const schema = z.object({ email: emailSchema, password: passwordSchema });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());

  const pool = getPool();
  const [[user]] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [
    parsed.data.email
  ]);
  if (!user) return badRequest(res, "Invalid credentials");

  const ok = await verifyPassword(parsed.data.password, user.password_hash);
  if (!ok) return badRequest(res, "Invalid credentials");

  const token = signToken(user);
  return res.json({ token, user: publicUser(user) });
}

async function me(req, res) {
  const pool = getPool();
  const [[user]] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [req.user.id]);
  if (!user) return res.status(401).json({ error: "Unknown user" });
  return res.json({ user: publicUser(user) });
}

module.exports = { register, login, me };

