const DEFAULT_NATIVE_API_BASE = "https://vtopia-chennai.vercel.app";

export function getApiBase() {
  let configured = "";
  try {
    configured = import.meta?.env?.VITE_API_BASE || "";
  } catch {
    configured = "";
  }
  if (configured) {
    return String(configured).replace(/\/+$/, "");
  }
  try {
    if (
      typeof window !== "undefined" &&
      window.Capacitor?.isNativePlatform?.()
    ) {
      return DEFAULT_NATIVE_API_BASE;
    }
  } catch {}
  return "";
}

export function apiUrl(path) {
  const base = getApiBase();
  if (!base) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function apiError(result, fallback) {
  const error = new Error(result.message || fallback);
  error.code = result.code;
  return error;
}

export async function fetchCaptcha(signal) {
  const response = await fetch(apiUrl("/api/captcha"), {
    cache: "no-store",
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw apiError(result, "Cannot connect to VTOP.");
  return result;
}
export async function fetchOverview(token, semesterId, signal) {
  const response = await fetch(apiUrl("/api/overview"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, semesterId }),
    cache: "no-store",
    signal,
  });
  const result = await response.json();
  if (!response.ok)
    throw apiError(result, "Overview details could not be fetched.");
  return result;
}

export async function fetchCalendar(token, semesterId, signal) {
  const response = await fetch(apiUrl("/api/calendar"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, semesterId }),
    cache: "no-store",
    signal,
  });
  const result = await response.json();
  if (!response.ok)
    throw apiError(result, "The academic calendar could not be fetched.");
  return result.calendar;
}
export async function fetchHostelLeave(token, signal) {
  const response = await fetch(apiUrl("/api/hostel-leave"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    signal,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw apiError(result, "Hostel leave details could not be fetched.");
  return result;
}
export async function syncRequest(payload, onProgress, signal) {
  const response = await fetch(apiUrl("/api/sync"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json();
    throw apiError(error, "Sync could not start.");
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    result;
  const consume = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "error") throw apiError(event, "Sync could not finish.");
    if (event.type === "progress") onProgress(event.message);
    if (event.type === "result") result = event;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      lines.forEach(consume);
      if (done) break;
    }
    consume(buffer);
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  if (!result)
    throw new Error(
      "The sync connection ended early. Your previous data is safe.",
    );
  return result;
}
