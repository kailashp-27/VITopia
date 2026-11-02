import { VtopClient } from "../lib/vtop.js";
import { sealSession, unsealSession } from "../lib/session.js";
import { AppError } from "../lib/errors.js";
import { prepare, readBody, sendError } from "../lib/http.js";
import { rateLimit } from "../lib/rate-limit.js";
export default async function handler(req, res) {
  let streaming = false;
  try {
    prepare(req, res, "POST");
    rateLimit(req, "sync", res);
    const body = await readBody(req);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new AppError("INVALID_BODY", "Invalid sync request.");
    const session = unsealSession(body.token);
    const client = new VtopClient(session);
    if (
      !session.authorizedID &&
      (typeof body.username !== "string" ||
        typeof body.captcha !== "string" ||
        !/^[A-Z0-9._-]{3,80}$/i.test(body.username || "") ||
        typeof body.password !== "string" ||
        !body.password.length ||
        body.password.length > 256 ||
        !/^[A-Z0-9]{6}$/i.test(body.captcha || ""))
    )
      throw new AppError(
        "INVALID_INPUT",
        "Enter your username, password, and the six-character captcha.",
      );
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("X-Accel-Buffering", "no");
    streaming = true;
    const progress = (stage, message) =>
      res.write(JSON.stringify({ type: "progress", stage, message }) + "\n");
    if (!session.authorizedID) {
      progress("login", "Logging in securely");
      try {
        await client.login(body.username, body.password, body.captcha);
      } finally {
        body.password = "";
      }
    }
    progress("semester", "Finding your semester");
    const semesters = await client.semesters();
    const semester = await client.chooseSemester(semesters, body.semesterId);
    const data = await client.fetchData(semester, progress);
    res.end(
      JSON.stringify({
        type: "result",
        data: { ...data, semesters },
        token: sealSession(client.snapshot()),
      }) + "\n",
    );
  } catch (error) {
    sendError(res, error, streaming);
  }
}
