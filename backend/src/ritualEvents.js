const { setTimeout: delay } = require("timers/promises");

// Comentario en español: PubSub in-memory (suficiente para un MVP con 1 instancia).
const groupStreams = new Map(); // groupId -> Set(res)

function ensureSet(groupId) {
  const key = String(groupId);
  if (!groupStreams.has(key)) groupStreams.set(key, new Set());
  return groupStreams.get(key);
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function subscribe(groupId, res) {
  const set = ensureSet(groupId);
  set.add(res);

  res.on("close", () => {
    set.delete(res);
    if (set.size === 0) groupStreams.delete(String(groupId));
  });
}

async function keepAlive(res) {
  // Comentario en español: Ping para evitar timeouts en proxies / navegadores.
  while (!res.writableEnded) {
    res.write(": ping\n\n");
    await delay(15000);
  }
}

function broadcast(groupId, payload) {
  const set = groupStreams.get(String(groupId));
  if (!set) return;
  for (const res of set) {
    try {
      sendSse(res, "state", payload);
    } catch {
      // Ignorar.
    }
  }
}

module.exports = { subscribe, broadcast, sendSse, keepAlive };

