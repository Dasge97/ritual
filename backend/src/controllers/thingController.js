const { getPool } = require("../config/db");
const { z, thingTypeSchema, emotionalWeightSchema } = require("../utils/validation");
const { badRequest, forbidden, notFound } = require("../utils/httpErrors");

async function createThing(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) return badRequest(res, "Invalid groupId");

  const schema = z.object({
    text: z.string().min(1).max(5000),
    type: thingTypeSchema,
    emotionalWeight: emotionalWeightSchema
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());

  const pool = getPool();
  const [[membership]] = await pool.query(
    "SELECT 1 AS ok FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1",
    [groupId, req.user.id]
  );
  if (!membership) return forbidden(res, "Not a member");

  const [result] = await pool.query(
    "INSERT INTO things (group_id, author_user_id, text, type, emotional_weight, status) VALUES (?, ?, ?, ?, ?, 'pending')",
    [groupId, req.user.id, parsed.data.text, parsed.data.type, parsed.data.emotionalWeight]
  );

  return res.status(201).json({ id: result.insertId });
}

async function listMyPendingThings(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) return badRequest(res, "Invalid groupId");

  const pool = getPool();
  const [[membership]] = await pool.query(
    "SELECT 1 AS ok FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1",
    [groupId, req.user.id]
  );
  if (!membership) return forbidden(res, "Not a member");

  const [rows] = await pool.query(
    `
    SELECT id, type, emotional_weight AS emotionalWeight, status, created_at AS createdAt, text
    FROM things
    WHERE group_id = ? AND author_user_id = ? AND status = 'pending'
    ORDER BY created_at DESC
    `,
    [groupId, req.user.id]
  );
  return res.json({ things: rows });
}

async function updateThing(req, res) {
  const thingId = Number(req.params.thingId);
  if (!Number.isFinite(thingId)) return badRequest(res, "Invalid thingId");

  const schema = z.object({
    text: z.string().min(1).max(5000),
    type: thingTypeSchema,
    emotionalWeight: emotionalWeightSchema
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());

  const pool = getPool();
  const [[thing]] = await pool.query(
    "SELECT id, author_user_id AS authorUserId, status FROM things WHERE id = ? LIMIT 1",
    [thingId]
  );
  if (!thing) return notFound(res, "Thing not found");
  if (Number(thing.authorUserId) !== req.user.id) return forbidden(res, "Not the author");
  if (thing.status !== "pending") return badRequest(res, "Only pending items can be edited");

  await pool.query("UPDATE things SET text = ?, type = ?, emotional_weight = ? WHERE id = ?", [
    parsed.data.text,
    parsed.data.type,
    parsed.data.emotionalWeight,
    thingId
  ]);
  return res.json({ ok: true });
}

async function deleteThing(req, res) {
  const thingId = Number(req.params.thingId);
  if (!Number.isFinite(thingId)) return badRequest(res, "Invalid thingId");

  const pool = getPool();
  const [[thing]] = await pool.query(
    "SELECT id, author_user_id AS authorUserId, status FROM things WHERE id = ? LIMIT 1",
    [thingId]
  );
  if (!thing) return notFound(res, "Thing not found");
  if (Number(thing.authorUserId) !== req.user.id) return forbidden(res, "Not the author");
  if (thing.status !== "pending") return badRequest(res, "Only pending items can be deleted");

  await pool.query("DELETE FROM things WHERE id = ?", [thingId]);
  return res.json({ ok: true });
}

module.exports = { createThing, listMyPendingThings, updateThing, deleteThing };

