import { createHash } from "node:crypto";
import { AppError } from "./errors.js";
// A bounded, best-effort guard for one function instance. Vercel Firewall must
// supply deployment-wide limits before opening a public deployment to others.
const buckets = new Map();
export function rateLimit(req, action, res, now = Date.now()) {
  const ip = process.env.VERCEL
    ? req.headers["x-real-ip"] || req.socket?.remoteAddress
    : req.socket?.remoteAddress;
  const id = createHash("sha256")
    .update(`${action}:${ip || "unknown"}`)
    .digest("hex");
  const limit = action === "captcha" ? 12 : 6;
  for (const [key, bucket] of buckets)
    if (bucket.expires <= now) buckets.delete(key);
  if (buckets.size >= 5000 && !buckets.has(id))
    throw new AppError(
      "RATE_LIMITED",
      "Sync is busy. Please try again in a minute.",
      429,
    );
  const bucket = buckets.get(id) || { count: 0, expires: now + 300000 };
  if (bucket.count >= limit) {
    res.setHeader("Retry-After", Math.ceil((bucket.expires - now) / 1000));
    throw new AppError(
      "RATE_LIMITED",
      "Too many attempts. Please wait five minutes before trying again.",
      429,
    );
  }
  bucket.count++;
  buckets.set(id, bucket);
}
