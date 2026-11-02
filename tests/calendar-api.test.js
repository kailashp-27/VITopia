import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import calendar from "../api/calendar.js";
process.env.SESSION_SECRET = randomBytes(32).toString("base64");
function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
}
test("calendar route rejects missing auth before accessing VTOP", async () => {
  const res = response();
  await calendar(
    {
      method: "POST",
      headers: { host: "localhost", "content-type": "application/json" },
      body: { token: "invalid", semesterId: "CH2026001" },
      socket: { remoteAddress: "127.0.0.1" },
    },
    res,
  );
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "SESSION_EXPIRED");
  assert.equal(res.headers["Cache-Control"], "no-store, private");
});
test("calendar route enforces HTTP method and same-origin restrictions", async () => {
  const get = response();
  await calendar({ method: "GET", headers: { host: "localhost" } }, get);
  assert.equal(get.statusCode, 405);
  const cross = response();
  await calendar(
    {
      method: "POST",
      headers: { host: "localhost", origin: "https://untrusted.example" },
    },
    cross,
  );
  assert.equal(cross.statusCode, 403);
});
