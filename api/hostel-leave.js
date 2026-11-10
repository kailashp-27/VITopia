import { VtopClient } from "../lib/vtop.js";
import { sealSession, unsealSession } from "../lib/session.js";
import { prepare, readBody, sendError } from "../lib/http.js";
import { rateLimit } from "../lib/rate-limit.js";
import { AppError } from "../lib/errors.js";
import { fetchHostelLeave } from "../lib/hostel-leave.js";

export function createLeaveHandler(
  clientFactory = (session) => new VtopClient(session),
) {
  return async (req, res) => {
    try {
      if (prepare(req, res, "POST")) return;
      rateLimit(req, "hostel-leave", res);
      const body = await readBody(req);
      const session = unsealSession(body?.token);
      if (!session.authorizedID)
        throw new AppError(
          "SESSION_EXPIRED",
          "Sync in Profile before fetching hostel leave.",
          401,
        );
      const client = clientFactory(session);
      const leave = await fetchHostelLeave(client);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ leave, token: sealSession(client.snapshot()) }));
    } catch (error) {
      sendError(res, error);
    }
  };
}
export default createLeaveHandler();
