import { getAuthToken, clearAuth } from "./stores/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export async function apiFetch(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });

  if (res.status === 401) {
    clearAuth();
    throw new Error("No autorizado");
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.error || `La solicitud falló (${res.status})`;
    const err = new Error(msg);
    err.data = data;
    throw err;
  }
  return data;
}
