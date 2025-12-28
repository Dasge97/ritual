const KEY = "ritual_auth";

export function getAuthToken() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user || null;
  } catch {
    return null;
  }
}

export function setAuth({ token, user }) {
  localStorage.setItem(KEY, JSON.stringify({ token, user }));
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}

