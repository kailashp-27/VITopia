import { VtopClient } from "../lib/vtop.js";
import { sealSession, unsealSession } from "../lib/session.js";
import { prepare, readBody, sendError } from "../lib/http.js";
import { rateLimit } from "../lib/rate-limit.js";
import { AppError } from "../lib/errors.js";
import { fetchOverview, validateOverviewSemester } from "../lib/overview.js";
export default async function handler(req, res) {
  try {
    prepare(req, res, "POST");
    rateLimit(req, "overview", res);
    const body = await readBody(req);
    const session = unsealSession(body?.token);
    validateOverviewSemester(body, session);
    const client = new VtopClient(session);
    const semesters = await client.semesters();
    if (!semesters.some((semester) => semester.id === body.semesterId))
      throw new AppError(
        "INVALID_SEMESTER",
        "This semester is not available for the current account.",
      );
    const overview = await fetchOverview(client, body.semesterId);
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({ overview, token: sealSession(client.snapshot()) }),
    );
  } catch (error) {
    sendError(res, error);
  }
}
