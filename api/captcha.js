import { VtopClient } from "../lib/vtop.js";
import { sealSession } from "../lib/session.js";
import { prepare, sendError } from "../lib/http.js";
import { rateLimit } from "../lib/rate-limit.js";
export default async function handler(req, res) {
  try {
    prepare(req, res, "GET");
    rateLimit(req, "captcha", res);
    // Validate configuration before creating an upstream session.
    sealSession({});
    const client = new VtopClient();
    const image = await client.captcha();
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        image,
        token: sealSession(client.snapshot()),
        expiresAt: Date.now() + 300000,
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
}
