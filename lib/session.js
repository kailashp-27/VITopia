import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "./errors.js";
const TTL = 5 * 60 * 1000;
function key() {
  const value = process.env.SESSION_SECRET;
  const decoded = Buffer.from(value || "", "base64");
  if (decoded.length !== 32)
    throw new AppError(
      "CONFIGURATION",
      "Sync is not configured. Set SESSION_SECRET on the server.",
      503,
    );
  return decoded;
}
export function sealSession(session, now = Date.now()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from("vtopia-session-v1"));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify({ ...session, expiresAt: now + TTL })),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function unsealSession(token, now = Date.now()) {
  try {
    if (typeof token !== "string" || token.length > 16000) throw new Error();
    const raw = Buffer.from(token, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      raw.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from("vtopia-session-v1"));
    decipher.setAuthTag(raw.subarray(12, 28));
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(raw.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= now)
      throw new Error();
    return payload;
  } catch (error) {
    if (error.code === "CONFIGURATION") throw error;
    throw new AppError(
      "SESSION_EXPIRED",
      "Your session expired. Load a new captcha and try again.",
      401,
    );
  }
}
