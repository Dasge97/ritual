const { withTransaction } = require("../config/db");
const { z } = require("../utils/validation");
const { badRequest } = require("../utils/httpErrors");
const { shuffleInPlace } = require("../utils/shuffle");
const { subscribe, sendSse, keepAlive, broadcast } = require("../ritualEvents");

async function assertMember(connection, groupId, userId) {
  const [[row]] = await connection.query(
    "SELECT 1 AS ok FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1",
    [groupId, userId]
  );
  return Boolean(row);
}

async function getOpenSession(connection, groupId) {
  const [[row]] = await connection.query(
    `
    SELECT *
    FROM ritual_sessions
    WHERE group_id = ? AND status IN ('voting','active','paused')
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [groupId]
  );
  return row || null;
}

async function getLatestSession(connection, groupId) {
  const [[row]] = await connection.query(
    `
    SELECT *
    FROM ritual_sessions
    WHERE group_id = ?
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [groupId]
  );
  return row || null;
}

function normalizeSession(row) {
  return {
    id: row.id,
    groupId: row.group_id,
    status: row.status,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    pausedAt: row.paused_at,
    completedAt: row.completed_at,
    currentPosition: row.current_position
  };
}

async function getProgress(connection, sessionId) {
  const [[row]] = await connection.query(
    "SELECT MAX(position) AS totalPositions FROM ritual_session_items WHERE ritual_session_id = ?",
    [sessionId]
  );
  return { totalPositions: Number(row?.totalPositions || 0) };
}

async function getBroadcastSnapshot(connection, groupId) {
  const session = await getLatestSession(connection, groupId);
  if (!session) return { session: null };

  const [[membersRow]] = await connection.query(
    "SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?",
    [groupId]
  );
  const totalMembers = Number(membersRow.c || 0);

  const [[yesRow]] = await connection.query(
    "SELECT COUNT(*) AS c FROM ritual_votes WHERE ritual_session_id = ? AND vote = 'yes'",
    [session.id]
  );
  const [[noRow]] = await connection.query(
    "SELECT COUNT(*) AS c FROM ritual_votes WHERE ritual_session_id = ? AND vote = 'no'",
    [session.id]
  );

  let current = null;
  if (session.status === "active" || session.status === "paused") {
    const [[item]] = await connection.query(
      `
      SELECT
        rsi.position,
        t.id AS thingId,
        t.type,
        t.emotional_weight AS emotionalWeight,
        t.status AS thingStatus,
        t.text,
        u.nickname AS authorNickname,
        DATEDIFF(COALESCE(t.told_at, CURRENT_TIMESTAMP), t.created_at) AS waitedDays
      FROM ritual_session_items rsi
      INNER JOIN things t ON t.id = rsi.thing_id
      INNER JOIN users u ON u.id = t.author_user_id
      WHERE rsi.ritual_session_id = ? AND rsi.position = ?
      LIMIT 1
      `,
      [session.id, session.current_position]
    );
    if (item) {
      current = {
        position: item.position,
        thingId: item.thingId,
        authorNickname: item.authorNickname,
        type: item.type,
        emotionalWeight: item.emotionalWeight,
        waitedDays: Number(item.waitedDays || 0),
        // Comentario en español: El texto nunca se emite en eventos si aún está pending.
        text: item.thingStatus === "told" ? item.text : null,
        thingStatus: item.thingStatus
      };
    }
  }

  const progress = await getProgress(connection, session.id);
  let closure = null;
  if (session.status === "completed") {
    const [[prevRow]] = await connection.query(
      `
      SELECT completed_at AS prevCompletedAt
      FROM ritual_sessions
      WHERE group_id = ? AND status = 'completed' AND id <> ?
      ORDER BY completed_at DESC
      LIMIT 1
      `,
      [groupId, session.id]
    );
    const [[daysRow]] = await connection.query(
      "SELECT DATEDIFF(COALESCE(?, CURRENT_TIMESTAMP), ?) AS daysSince",
      [session.completed_at, prevRow ? prevRow.prevCompletedAt : null]
    );
    const [[countRow]] = await connection.query(
      "SELECT COUNT(*) AS c FROM ritual_session_items WHERE ritual_session_id = ?",
      [session.id]
    );
    closure = {
      daysSinceLastRitual: prevRow ? Number(daysRow.daysSince || 0) : null,
      itemsTold: Number(countRow.c || 0)
    };
  }

  return {
    session: normalizeSession(session),
    voting: { totalMembers, yesVotes: Number(yesRow.c || 0), noVotes: Number(noRow.c || 0) },
    progress: { currentPosition: Number(session.current_position), totalPositions: progress.totalPositions },
    current,
    closure
  };
}

async function computeState(connection, sessionId, totalMembers, userId) {
  const [[yesRow]] = await connection.query(
    "SELECT COUNT(*) AS c FROM ritual_votes WHERE ritual_session_id = ? AND vote = 'yes'",
    [sessionId]
  );
  const [[noRow]] = await connection.query(
    "SELECT COUNT(*) AS c FROM ritual_votes WHERE ritual_session_id = ? AND vote = 'no'",
    [sessionId]
  );
  const [[myRow]] = await connection.query(
    "SELECT vote FROM ritual_votes WHERE ritual_session_id = ? AND user_id = ? LIMIT 1",
    [sessionId, userId]
  );
  const [[session]] = await connection.query("SELECT * FROM ritual_sessions WHERE id = ? LIMIT 1", [
    sessionId
  ]);

  return {
    session: normalizeSession(session),
    voting: {
      totalMembers,
      yesVotes: Number(yesRow.c || 0),
      noVotes: Number(noRow.c || 0),
      myVote: myRow ? myRow.vote : null
    }
  };
}

async function startVote(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) return badRequest(res, "Invalid groupId");

  const result = await withTransaction(async (connection) => {
    const isMember = await assertMember(connection, groupId, req.user.id);
    if (!isMember) return { status: 403, payload: { error: "Not a member" } };

    const existing = await getOpenSession(connection, groupId);
    if (existing) return { status: 200, payload: { session: normalizeSession(existing) } };

    const [insert] = await connection.query(
      "INSERT INTO ritual_sessions (group_id, status) VALUES (?, 'voting')",
      [groupId]
    );
    const [[created]] = await connection.query("SELECT * FROM ritual_sessions WHERE id = ?", [
      insert.insertId
    ]);
    return { status: 201, payload: { session: normalizeSession(created) } };
  });

  // Comentario en español: Emitimos evento para que todos vean el cambio sin refrescar.
  await withTransaction(async (connection) => {
    const snapshot = await getBroadcastSnapshot(connection, groupId);
    broadcast(groupId, snapshot);
  });

  return res.status(result.status).json(result.payload);
}

async function castVote(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) return badRequest(res, "Invalid groupId");

  const schema = z.object({ vote: z.enum(["yes", "no"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "Invalid input", parsed.error.flatten());

  const result = await withTransaction(async (connection) => {
    const isMember = await assertMember(connection, groupId, req.user.id);
    if (!isMember) return { status: 403, payload: { error: "Not a member" } };

    const session = await getOpenSession(connection, groupId);
    if (!session) return { status: 400, payload: { error: "No open ritual session" } };
    if (session.status !== "voting")
      return { status: 400, payload: { error: "Voting is not open" } };

    await connection.query(
      `
      INSERT INTO ritual_votes (ritual_session_id, user_id, vote)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE vote = VALUES(vote), voted_at = CURRENT_TIMESTAMP
      `,
      [session.id, req.user.id, parsed.data.vote]
    );

    const [[membersRow]] = await connection.query(
      "SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?",
      [groupId]
    );
    const totalMembers = Number(membersRow.c || 0);
    const [[yesRow]] = await connection.query(
      "SELECT COUNT(*) AS c FROM ritual_votes WHERE ritual_session_id = ? AND vote = 'yes'",
      [session.id]
    );
    const yesVotes = Number(yesRow.c || 0);

    if (yesVotes <= totalMembers / 2) {
      const state = await computeState(connection, session.id, totalMembers, req.user.id);
      return { status: 200, payload: state };
    }

    await connection.query(
      "UPDATE ritual_sessions SET status = 'active', activated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [session.id]
    );

    // Comentario en español: El orden se decide al inicio del ritual (en este momento).
    const [pendingRows] = await connection.query(
      "SELECT id FROM things WHERE group_id = ? AND status = 'pending' ORDER BY id ASC",
      [groupId]
    );
    const pendingThingIds = pendingRows.map((r) => r.id);
    shuffleInPlace(pendingThingIds);

    if (pendingThingIds.length === 0) {
      await connection.query(
        "UPDATE ritual_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [session.id]
      );
      const [[updated]] = await connection.query("SELECT * FROM ritual_sessions WHERE id = ?", [
        session.id
      ]);
      return {
        status: 200,
        payload: {
          session: normalizeSession(updated),
          voting: {
            totalMembers,
            yesVotes,
            noVotes: totalMembers - yesVotes,
            myVote: parsed.data.vote
          },
          closure: { daysSinceLastRitual: null, itemsTold: 0 }
        }
      };
    }

    for (let i = 0; i < pendingThingIds.length; i++) {
      await connection.query(
        "INSERT INTO ritual_session_items (ritual_session_id, position, thing_id) VALUES (?, ?, ?)",
        [session.id, i + 1, pendingThingIds[i]]
      );
    }

    const [[updated]] = await connection.query("SELECT * FROM ritual_sessions WHERE id = ?", [
      session.id
    ]);
    return { status: 200, payload: { session: normalizeSession(updated) } };
  });

  await withTransaction(async (connection) => {
    const snapshot = await getBroadcastSnapshot(connection, groupId);
    broadcast(groupId, snapshot);
  });

  return res.status(result.status).json(result.payload);
}

async function ritualState(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) return badRequest(res, "Invalid groupId");

  const payload = await withTransaction(async (connection) => {
    const isMember = await assertMember(connection, groupId, req.user.id);
    if (!isMember) return { status: 403, payload: { error: "Not a member" } };

    const session = await getOpenSession(connection, groupId);
    if (!session) return { status: 200, payload: { session: null } };

    const [[membersRow]] = await connection.query(
      "SELECT COUNT(*) AS c FROM group_members WHERE group_id = ?",
      [groupId]
    );
    const totalMembers = Number(membersRow.c || 0);
    const state = await computeState(connection, session.id, totalMembers, req.user.id);
    return { status: 200, payload: state };
  });

  return res.status(payload.status).json(payload.payload);
}

async function ritualStream(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) return badRequest(res, "Invalid groupId");

  // Comentario en español: SSE con auth por header (usamos fetch streaming en frontend).
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const allowed = await withTransaction(async (connection) => {
    const isMember = await assertMember(connection, groupId, req.user.id);
    if (!isMember) return { ok: false };
    const snapshot = await getBroadcastSnapshot(connection, groupId);
    return { ok: true, snapshot };
  });

  if (!allowed.ok) {
    res.statusCode = 403;
    sendSse(res, "error", { error: "Not a member" });
    return res.end();
  }

  subscribe(groupId, res);
  sendSse(res, "state", allowed.snapshot);
  keepAlive(res);
}

async function ritualCurrent(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) return badRequest(res, "Invalid groupId");

  const payload = await withTransaction(async (connection) => {
    const isMember = await assertMember(connection, groupId, req.user.id);
    if (!isMember) return { status: 403, payload: { error: "Not a member" } };

    const session = await getOpenSession(connection, groupId);
    if (!session) return { status: 200, payload: { session: null, current: null } };
    if (session.status === "voting")
      return { status: 200, payload: { session: normalizeSession(session), current: null } };

    const [[item]] = await connection.query(
      `
      SELECT
        rsi.position,
        t.id AS thingId,
        t.type,
        t.emotional_weight AS emotionalWeight,
        t.status AS thingStatus,
        t.text,
        u.nickname AS authorNickname,
        DATEDIFF(COALESCE(t.told_at, CURRENT_TIMESTAMP), t.created_at) AS waitedDays
      FROM ritual_session_items rsi
      INNER JOIN things t ON t.id = rsi.thing_id
      INNER JOIN users u ON u.id = t.author_user_id
      WHERE rsi.ritual_session_id = ? AND rsi.position = ?
      LIMIT 1
      `,
      [session.id, session.current_position]
    );

    if (!item)
      return { status: 200, payload: { session: normalizeSession(session), current: null } };

    return {
      status: 200,
      payload: {
        session: normalizeSession(session),
        current: {
          position: item.position,
          thingId: item.thingId,
          authorNickname: item.authorNickname,
          type: item.type,
          emotionalWeight: item.emotionalWeight,
          waitedDays: Number(item.waitedDays || 0),
          // Comentario en español: El texto NO se envía mientras siga pendiente.
          text: item.thingStatus === "told" ? item.text : null,
          thingStatus: item.thingStatus
        }
      }
    };
  });

  return res.status(payload.status).json(payload.payload);
}

async function tellCurrent(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) return badRequest(res, "Invalid groupId");

  const payload = await withTransaction(async (connection) => {
    const isMember = await assertMember(connection, groupId, req.user.id);
    if (!isMember) return { status: 403, payload: { error: "Not a member" } };

    const session = await getOpenSession(connection, groupId);
    if (!session) return { status: 400, payload: { error: "No open ritual session" } };
    if (session.status !== "active")
      return { status: 400, payload: { error: "Ritual is not active" } };

    const [[item]] = await connection.query(
      `
      SELECT rsi.position, t.id AS thingId, t.status, t.text
      FROM ritual_session_items rsi
      INNER JOIN things t ON t.id = rsi.thing_id
      WHERE rsi.ritual_session_id = ? AND rsi.position = ?
      LIMIT 1
      `,
      [session.id, session.current_position]
    );
    if (!item) return { status: 400, payload: { error: "No current item" } };
    if (item.status !== "pending")
      return { status: 400, payload: { error: "Current item already told" } };

    await connection.query(
      "UPDATE things SET status = 'told', told_at = CURRENT_TIMESTAMP WHERE id = ?",
      [item.thingId]
    );
    await connection.query(
      "UPDATE ritual_session_items SET told_at = CURRENT_TIMESTAMP WHERE ritual_session_id = ? AND position = ?",
      [session.id, item.position]
    );

    const [[maxPosRow]] = await connection.query(
      "SELECT MAX(position) AS maxPos FROM ritual_session_items WHERE ritual_session_id = ?",
      [session.id]
    );
    const maxPos = Number(maxPosRow.maxPos || 0);
    const nextPosition = Number(session.current_position) + 1;

    if (nextPosition > maxPos) {
      await connection.query(
        "UPDATE ritual_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [session.id]
      );

      const [[prevRow]] = await connection.query(
        `
        SELECT completed_at AS prevCompletedAt
        FROM ritual_sessions
        WHERE group_id = ? AND status = 'completed' AND id <> ?
        ORDER BY completed_at DESC
        LIMIT 1
        `,
        [groupId, session.id]
      );

      const [[daysRow]] = await connection.query(
        "SELECT DATEDIFF(CURRENT_TIMESTAMP, ?) AS daysSince",
        [prevRow ? prevRow.prevCompletedAt : null]
      );
      const [[countRow]] = await connection.query(
        "SELECT COUNT(*) AS c FROM ritual_session_items WHERE ritual_session_id = ? AND told_at IS NOT NULL",
        [session.id]
      );

      return {
        status: 200,
        payload: {
          revealedText: item.text,
          completed: true,
          closure: {
            daysSinceLastRitual: prevRow ? Number(daysRow.daysSince || 0) : null,
            itemsTold: Number(countRow.c || 0)
          }
        }
      };
    }

    await connection.query("UPDATE ritual_sessions SET current_position = ? WHERE id = ?", [
      nextPosition,
      session.id
    ]);

    return { status: 200, payload: { revealedText: item.text, completed: false } };
  });

  await withTransaction(async (connection) => {
    const snapshot = await getBroadcastSnapshot(connection, groupId);
    broadcast(groupId, snapshot);
  });

  return res.status(payload.status).json(payload.payload);
}

async function pauseRitual(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) return badRequest(res, "Invalid groupId");

  const payload = await withTransaction(async (connection) => {
    const isMember = await assertMember(connection, groupId, req.user.id);
    if (!isMember) return { status: 403, payload: { error: "Not a member" } };

    const session = await getOpenSession(connection, groupId);
    if (!session) return { status: 400, payload: { error: "No open ritual session" } };
    if (session.status !== "active") return { status: 400, payload: { error: "Not active" } };

    await connection.query(
      "UPDATE ritual_sessions SET status = 'paused', paused_at = CURRENT_TIMESTAMP WHERE id = ?",
      [session.id]
    );
    const [[updated]] = await connection.query("SELECT * FROM ritual_sessions WHERE id = ?", [
      session.id
    ]);
    return { status: 200, payload: { session: normalizeSession(updated) } };
  });

  await withTransaction(async (connection) => {
    const snapshot = await getBroadcastSnapshot(connection, groupId);
    broadcast(groupId, snapshot);
  });

  return res.status(payload.status).json(payload.payload);
}

async function resumeRitual(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) return badRequest(res, "Invalid groupId");

  const payload = await withTransaction(async (connection) => {
    const isMember = await assertMember(connection, groupId, req.user.id);
    if (!isMember) return { status: 403, payload: { error: "Not a member" } };

    const session = await getOpenSession(connection, groupId);
    if (!session) return { status: 400, payload: { error: "No open ritual session" } };
    if (session.status !== "paused") return { status: 400, payload: { error: "Not paused" } };

    await connection.query("UPDATE ritual_sessions SET status = 'active' WHERE id = ?", [session.id]);
    const [[updated]] = await connection.query("SELECT * FROM ritual_sessions WHERE id = ?", [
      session.id
    ]);
    return { status: 200, payload: { session: normalizeSession(updated) } };
  });

  await withTransaction(async (connection) => {
    const snapshot = await getBroadcastSnapshot(connection, groupId);
    broadcast(groupId, snapshot);
  });

  return res.status(payload.status).json(payload.payload);
}

module.exports = {
  startVote,
  castVote,
  ritualState,
  ritualStream,
  ritualCurrent,
  tellCurrent,
  pauseRitual,
  resumeRitual
};
