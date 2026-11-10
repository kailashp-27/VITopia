import { AppError } from "./errors.js";

const NATIVE_APP_ORIGINS = new Set([
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
]);

function applyCorsHeaders(res, origin, method) {
  if (!NATIVE_APP_ORIGINS.has(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", `${method}, OPTIONS`);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

export function prepare(req, res, method) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const origin = req.headers.origin;
  const host = process.env.VERCEL
    ? req.headers["x-forwarded-host"] || req.headers.host
    : req.headers.host;
  const isNativeOrigin = !!(origin && NATIVE_APP_ORIGINS.has(origin));
  let isSameOrigin = false;
  if (origin) {
    try {
      isSameOrigin = new URL(origin).host === host;
    } catch {
      isSameOrigin = false;
    }
  }

  if (req.method === "OPTIONS") {
    if (!origin || (!isNativeOrigin && !isSameOrigin)) {
      throw new AppError("FORBIDDEN", "Please sync from Vtopia itself.", 403);
    }
    applyCorsHeaders(res, origin, method);
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (req.method !== method) {
    res.setHeader("Allow", method);
    throw new AppError("METHOD_NOT_ALLOWED", "Method not allowed.", 405);
  }

  if (
    (!isNativeOrigin && req.headers["sec-fetch-site"] === "cross-site") ||
    (origin && !isNativeOrigin && !isSameOrigin)
  ) {
    throw new AppError("FORBIDDEN", "Please sync from Vtopia itself.", 403);
  }

  if (isNativeOrigin) {
    applyCorsHeaders(res, origin, method);
  }
  return false;
}
export async function readBody(req) {
  if (!(req.headers["content-type"] || "").startsWith("application/json"))
    throw new AppError("INVALID_BODY", "Expected JSON.", 415);
  let body;
  if (req.body !== undefined) {
    if (
      Buffer.byteLength(
        typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      ) > 20000
    )
      throw new AppError("INVALID_BODY", "Request too large.", 413);
    body = req.body;
  } else {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 20000)
        throw new AppError("INVALID_BODY", "Request too large.", 413);
    }
    body = raw;
  }
  try {
    return typeof body === "string" ? JSON.parse(body) : body;
  } catch {
    throw new AppError("INVALID_BODY", "Invalid JSON.");
  }
}
export function sendError(res, error, streaming = false) {
  const known = error instanceof AppError;
  const safe = {
    code: known ? error.code : "INTERNAL_ERROR",
    message: known ? error.message : "Sync could not finish. Please try again.",
  };
  console.error("Vtopia request failed:", safe.code);
  if (streaming) res.end(JSON.stringify({ type: "error", ...safe }) + "\n");
  else {
    res.statusCode = known ? error.status : 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(safe));
  }
}
