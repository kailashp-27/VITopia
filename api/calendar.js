import { VtopClient } from "../lib/vtop.js";
import { unsealSession } from "../lib/session.js";
import { AppError } from "../lib/errors.js";
import { prepare, readBody, sendError } from "../lib/http.js";
import { rateLimit } from "../lib/rate-limit.js";
import { fetchAcademicCalendar } from "../lib/calendar.js";
export default async function handler(req, res) {
  try {
    if (prepare(req, res, "POST")) return;
    rateLimit(req, "calendar", res);
    const body = await readBody(req);
    let session;
    try {
      session = unsealSession(body?.token);
    } catch (error) {
      if (error.code === "SESSION_EXPIRED")
        throw new AppError(
          "SESSION_EXPIRED",
          "Sync in Profile to refresh the academic calendar.",
          401,
        );
      throw error;
    }
    if (!session.authorizedID)
      throw new AppError(
        "SESSION_EXPIRED",
        "Sync your account to refresh the academic calendar.",
        401,
      );
    if (
      typeof body.semesterId !== "string" ||
      !/^[A-Z0-9_-]{3,40}$/i.test(body.semesterId)
    )
      throw new AppError("INVALID_SEMESTER", "Select a valid semester.");
    const client = new VtopClient(session);
    const semesters = await client.semesters();
    if (!semesters.some((semester) => semester.id === body.semesterId))
      throw new AppError(
        "INVALID_SEMESTER",
        "This semester is not available for the current account.",
      );
    const calendar = await fetchAcademicCalendar(client, body.semesterId);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ calendar }));
  } catch (error) {
    sendError(res, error);
  }
}
