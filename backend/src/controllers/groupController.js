const crypto = require("crypto");
const { getPool, withTransaction } = require("../config/db");
const { z, groupNameSchema, emailSchema } = require("../utils/validation");
const { badRequest, forbidden, notFound } = require("../utils/httpErrors");

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function getFrontendBaseUrl() {
  return process.env.FRONTEND_BASE_URL || process.env.CORS_ORIGIN;
}

async function assertGroupMember(connection, groupId, userId) {
  const [[row]] = await connection.query(
    "SELECT 1 AS ok FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1",
    [groupId, userId]
  );
  return Boolean(row);
}

async function listGroups(req, res) {
  const pool = getPool();
  const [rows] = await pool.query(
    `
    SELECT
      g.id,
      g.name,
      g.creator_user_id AS creatorUserId,
      g.created_at AS createdAt,
      (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS memberCount,
      (SELECT COUNT(*) FROM things t WHERE t.group_id = g.id AND t.author_user_id = ? AND t.status = 'pending') AS myPendingCount
    FROM \`groups\` g
    INNER JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
    `,
    [req.user.id, req.user.id]
  );
  return res.json({ groups: rows });
}

async function createGroup(req, res) {
  const schema = z.object({ name: groupNameSchema });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());

  const pool = getPool();
  const [[countRow]] = await pool.query(
    "SELECT COUNT(*) AS c FROM group_members WHERE user_id = ?",
    [req.user.id]
  );
  if (Number(countRow.c) >= 20) return badRequest(res, "Group limit reached (20)");

  const group = await withTransaction(async (connection) => {
    const [result] = await connection.query(
      "INSERT INTO `groups` (name, creator_user_id) VALUES (?, ?)",
      [parsed.data.name, req.user.id]
    );
    await connection.query("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", [
      result.insertId,
      req.user.id
    ]);
    const [[created]] = await connection.query("SELECT * FROM `groups` WHERE id = ?", [
      result.insertId
    ]);
    return created;
  });

  return res.status(201).json({
    group: {
      id: group.id,
      name: group.name,
      creatorUserId: group.creator_user_id,
      createdAt: group.created_at
    }
  });
}

async function getGroup(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) return badRequest(res, "Invalid groupId");

  const pool = getPool();
  const [[group]] = await pool.query("SELECT * FROM `groups` WHERE id = ? LIMIT 1", [groupId]);
  if (!group) return notFound(res, "Group not found");

  const [[membership]] = await pool.query(
    "SELECT 1 AS ok FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1",
    [groupId, req.user.id]
  );
  if (!membership) return forbidden(res, "Not a member");

  // Comentario en espaÃ±ol: Para el indicador de peso emocional, usamos el mÃ¡ximo entre los pendientes del usuario.
  const [members] = await pool.query(
    `
    SELECT
      u.id,
      u.nickname,
      u.avatar_url AS avatarUrl,
      COUNT(t.id) AS pendingCount,
      MAX(
        CASE t.emotional_weight
          WHEN 'difficult' THEN 3
          WHEN 'important' THEN 2
          WHEN 'normal' THEN 1
          ELSE 0
        END
      ) AS pendingWeightScore
    FROM group_members gm
    INNER JOIN users u ON u.id = gm.user_id
    LEFT JOIN things t ON t.group_id = gm.group_id AND t.author_user_id = gm.user_id AND t.status = 'pending'
    WHERE gm.group_id = ?
    GROUP BY u.id, u.nickname, u.avatar_url
    ORDER BY u.nickname ASC
    `,
    [groupId]
  );

  const membersNormalized = members.map((m) => {
    const score = Number(m.pendingWeightScore || 0);
    let pendingWeight = null;
    if (score === 1) pendingWeight = "normal";
    if (score === 2) pendingWeight = "important";
    if (score === 3) pendingWeight = "difficult";
    return {
      id: m.id,
      nickname: m.nickname,
      avatarUrl: m.avatarUrl || null,
      pendingCount: Number(m.pendingCount || 0),
      pendingWeight
    };
  });

  const [[latestSession]] = await pool.query(
    `
    SELECT *
    FROM ritual_sessions
    WHERE group_id = ?
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [groupId]
  );

  let ritual = null;
  if (latestSession) {
    const [[yesRow]] = await pool.query(
      "SELECT COUNT(*) AS c FROM ritual_votes WHERE ritual_session_id = ? AND vote = 'yes'",
      [latestSession.id]
    );
    const [[membersRow]] = await pool.query(
      "SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?",
      [groupId]
    );
    const [[maxPosRow]] = await pool.query(
      "SELECT MAX(position) AS totalPositions FROM ritual_session_items WHERE ritual_session_id = ?",
      [latestSession.id]
    );
    ritual = {
      session: {
        id: latestSession.id,
        status: latestSession.status,
        currentPosition: Number(latestSession.current_position),
        totalPositions: Number(maxPosRow?.totalPositions || 0)
      },
      voting: {
        yesVotes: Number(yesRow.c || 0),
        totalMembers: Number(membersRow.c || 0)
      }
    };
  }

  return res.json({
    group: {
      id: group.id,
      name: group.name,
      creatorUserId: group.creator_user_id,
      createdAt: group.created_at
    },
    members: membersNormalized,
    ritual
  });
}

async function inviteToGroup(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) return badRequest(res, "Invalid groupId");

  const schema = z.object({ email: emailSchema });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());

  const result = await withTransaction(async (connection) => {
    const isMember = await assertGroupMember(connection, groupId, req.user.id);
    if (!isMember) return { status: 403, payload: { error: "Not a member" } };

    const [[group]] = await connection.query("SELECT id FROM `groups` WHERE id = ? LIMIT 1", [
      groupId
    ]);
    if (!group) return { status: 404, payload: { error: "Group not found" } };

    const [[invitee]] = await connection.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
      parsed.data.email
    ]);
    if (!invitee) {
      // Comentario en espaÃ±ol: Creamos invitaciÃ³n pendiente por email.
      const [[memberCountRow]] = await connection.query(
        "SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?",
        [groupId]
      );
      if (Number(memberCountRow.c) >= 20)
        return { status: 400, payload: { error: "Group member limit reached (20)" } };

      const emailLower = String(parsed.data.email).toLowerCase();
      const [[existingInvite]] = await connection.query(
        `
        SELECT id
        FROM group_invites
        WHERE group_id = ? AND invited_email = ? AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [groupId, emailLower]
      );

      if (existingInvite) {
        return {
          status: 200,
          payload: { ok: true, pendingInvite: true, message: "Invite already pending" }
        };
      }

      const inviteToken = crypto.randomBytes(24).toString("hex");
      const tokenHash = sha256Hex(inviteToken);
      await connection.query(
        `
        INSERT INTO group_invites (group_id, invited_email, token_hash, created_by_user_id)
        VALUES (?, ?, ?, ?)
        `,
        [groupId, emailLower, tokenHash, req.user.id]
      );

      const inviteLink = `${getFrontendBaseUrl()}/invites/${inviteToken}`;
      return { status: 201, payload: { ok: true, pendingInvite: true, inviteLink } };
    }

    const [[already]] = await connection.query(
      "SELECT 1 AS ok FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1",
      [groupId, invitee.id]
    );
    if (already) return { status: 200, payload: { ok: true, alreadyMember: true } };

    const [[memberCountRow]] = await connection.query(
      "SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?",
      [groupId]
    );
    if (Number(memberCountRow.c) >= 20)
      return { status: 400, payload: { error: "Group member limit reached (20)" } };

    const [[groupCountRow]] = await connection.query(
      "SELECT COUNT(*) AS c FROM group_members WHERE user_id = ?",
      [invitee.id]
    );
    if (Number(groupCountRow.c) >= 20)
      return { status: 400, payload: { error: "User group limit reached (20)" } };

    await connection.query("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", [
      groupId,
      invitee.id
    ]);
    return { status: 201, payload: { ok: true } };
  });

  return res.status(result.status).json(result.payload);
}

async function acceptInvite(req, res) {
  const schema = z.object({ token: z.string().min(10).max(200) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());

  const tokenHash = sha256Hex(parsed.data.token);

  const result = await withTransaction(async (connection) => {
    const [[user]] = await connection.query("SELECT id, email FROM users WHERE id = ? LIMIT 1", [
      req.user.id
    ]);
    if (!user) return { status: 401, payload: { error: "Unknown user" } };

    const emailLower = String(user.email).toLowerCase();
    const [[invite]] = await connection.query(
      `
      SELECT *
      FROM group_invites
      WHERE token_hash = ? AND status = 'pending'
      LIMIT 1
      `,
      [tokenHash]
    );
    if (!invite) return { status: 404, payload: { error: "Invite not found" } };
    if (String(invite.invited_email).toLowerCase() !== emailLower)
      return { status: 403, payload: { error: "Invite email does not match your account" } };

    const groupId = Number(invite.group_id);

    const [[already]] = await connection.query(
      "SELECT 1 AS ok FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1",
      [groupId, req.user.id]
    );
    if (already) {
      await connection.query(
        "UPDATE group_invites SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, accepted_by_user_id = ? WHERE id = ?",
        [req.user.id, invite.id]
      );
      return { status: 200, payload: { ok: true, groupId } };
    }

    const [[memberCountRow]] = await connection.query(
      "SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?",
      [groupId]
    );
    if (Number(memberCountRow.c) >= 20)
      return { status: 400, payload: { error: "Group member limit reached (20)" } };

    const [[groupCountRow]] = await connection.query(
      "SELECT COUNT(*) AS c FROM group_members WHERE user_id = ?",
      [req.user.id]
    );
    if (Number(groupCountRow.c) >= 20)
      return { status: 400, payload: { error: "User group limit reached (20)" } };

    await connection.query("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", [
      groupId,
      req.user.id
    ]);
    await connection.query(
      "UPDATE group_invites SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, accepted_by_user_id = ? WHERE id = ?",
      [req.user.id, invite.id]
    );

    return { status: 200, payload: { ok: true, groupId } };
  });

  return res.status(result.status).json(result.payload);
}

async function groupHistory(req, res) {
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
    SELECT
      rs.id AS ritualSessionId,
      rs.completed_at AS ritualDate,
      rsi.position,
      u.nickname AS authorNickname,
      t.type,
      t.emotional_weight AS emotionalWeight,
      t.text,
      DATEDIFF(rsi.told_at, t.created_at) AS waitedDays
    FROM ritual_sessions rs
    INNER JOIN ritual_session_items rsi ON rsi.ritual_session_id = rs.id
    INNER JOIN things t ON t.id = rsi.thing_id
    INNER JOIN users u ON u.id = t.author_user_id
    WHERE rs.group_id = ? AND rs.status = 'completed'
    ORDER BY rs.completed_at DESC, rsi.position ASC
    `,
    [groupId]
  );

  // Comentario en espaÃ±ol: Agrupamos por sesiÃ³n para facilitar UI.
  const sessions = [];
  const byId = new Map();
  for (const row of rows) {
    const key = String(row.ritualSessionId);
    if (!byId.has(key)) {
      const s = { ritualSessionId: row.ritualSessionId, ritualDate: row.ritualDate, items: [] };
      byId.set(key, s);
      sessions.push(s);
    }
    byId.get(key).items.push({
      position: row.position,
      authorNickname: row.authorNickname,
      type: row.type,
      emotionalWeight: row.emotionalWeight,
      waitedDays: row.waitedDays,
      text: row.text
    });
  }

  return res.json({ sessions });
}

module.exports = { listGroups, createGroup, acceptInvite, getGroup, inviteToGroup, groupHistory };



