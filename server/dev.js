import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createServer as createViteServer } from "vite";
import captcha from "../api/captcha.js";
import sync from "../api/sync.js";
import calendar from "../api/calendar.js";
import overview from "../api/overview.js";
import hostelLeave from "../api/hostel-leave.js";
if (!process.env.SESSION_SECRET)
  process.env.SESSION_SECRET = randomBytes(32).toString("base64");
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "spa",
});
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/api/captcha") return void captcha(req, res);
  if (path === "/api/sync") return void sync(req, res);
  if (path === "/api/calendar") return void calendar(req, res);
  if (path === "/api/overview") return void overview(req, res);
  if (path === "/api/hostel-leave") return void hostelLeave(req, res);
  if (path.startsWith("/api/")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end('{"message":"Not found"}');
  }
  vite.middlewares(req, res);
});
const port = Number(process.env.PORT) || 5184;
server.listen(port, "127.0.0.1", () =>
  console.log(`Vtopia is ready at http://127.0.0.1:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close();
    void vite.close().then(() => process.exit());
  });
