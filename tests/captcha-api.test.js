import test from "node:test";
import assert from "node:assert/strict";
import { VtopClient } from "../lib/vtop.js";
import { fetchCaptcha, syncRequest } from "../src/api-client.js";

test("VTOP image captcha and Google challenge produce distinct outcomes", async () => {
  for (const [html, code] of [
    [
      '<div id="captchaBlock"><img src="data:image/png;base64,AAAA"></div>',
      null,
    ],
    [
      '<div class="g-recaptcha" data-sitekey="fixture-key"></div>',
      "GOOGLE_VERIFICATION_REQUIRED",
    ],
    ["<div>No verification available</div>", "CAPTCHA_UNSUPPORTED"],
  ]) {
    const paths = [];
    const client = new VtopClient({}, async (url) => {
      paths.push(url.pathname);
      return new Response(
        paths.length === 1 ? '<input name="_csrf" value="fixture-csrf">' : html,
      );
    });
    if (code) await assert.rejects(client.captcha(), { code });
    else assert.equal(await client.captcha(), "data:image/png;base64,AAAA");
    assert.deepEqual(paths, ["/vtop/login", "/vtop/prelogin/setup"]);
  }
});
test("rejected VTOP image answers retain the code that triggers manual recovery", async () => {
  const client = new VtopClient(
    {},
    async () => new Response("<body>Invalid captcha</body>"),
  );
  await assert.rejects(client.login("TEST", "fixture-password", "ABC234"), {
    code: "INVALID_CAPTCHA",
  });
});
test("browser client preserves Google and image-captcha error codes", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      {
        code: "GOOGLE_VERIFICATION_REQUIRED",
        message: "Google verification required",
      },
      { status: 503 },
    ),
  );
  await assert.rejects(fetchCaptcha(), {
    code: "GOOGLE_VERIFICATION_REQUIRED",
  });
  globalThis.fetch.mock.mockImplementation(
    async () =>
      new Response(
        '{"type":"progress","message":"Logging in"}\n{"type":"error","code":"INVALID_CAPTCHA","message":"Incorrect captcha"}\n',
      ),
  );
  const messages = [];
  await assert.rejects(
    syncRequest({}, (message) => messages.push(message)),
    { code: "INVALID_CAPTCHA" },
  );
  assert.deepEqual(messages, ["Logging in"]);
  globalThis.fetch.mock.mockImplementation(async () =>
    Response.json(
      { code: "SESSION_EXPIRED", message: "Expired" },
      { status: 401 },
    ),
  );
  await assert.rejects(
    syncRequest({}, () => {}),
    { code: "SESSION_EXPIRED" },
  );
});
