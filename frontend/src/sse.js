import { getAuthToken } from "./stores/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// Comentario en español: Cliente SSE vía fetch streaming para poder enviar Authorization header.
export function subscribeRitualEvents(groupId, onState) {
  const controller = new AbortController();
  let closed = false;

  async function run() {
    const token = getAuthToken();
    if (!token) throw new Error("Unauthorized");

    const res = await fetch(`${API_BASE_URL}/api/groups/${groupId}/rituals/stream`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`Stream failed (${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = null;
    let currentData = null;

    while (!closed) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);

        const trimmed = line.replace(/\r$/, "");
        if (trimmed.startsWith(":")) continue; // ping/comment

        if (trimmed === "") {
          if (currentEvent === "state" && currentData) {
            try {
              onState(JSON.parse(currentData));
            } catch {
              // Ignorar.
            }
          }
          currentEvent = null;
          currentData = null;
          continue;
        }

        if (trimmed.startsWith("event:")) {
          currentEvent = trimmed.slice("event:".length).trim();
          continue;
        }
        if (trimmed.startsWith("data:")) {
          currentData = trimmed.slice("data:".length).trim();
          continue;
        }
      }
    }
  }

  run().catch(() => {
    // Ignorar: el componente decide si hace fallback.
  });

  return {
    close() {
      closed = true;
      controller.abort();
    }
  };
}

