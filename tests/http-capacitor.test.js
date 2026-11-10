import test from "node:test";
import assert from "node:assert/strict";
import { prepare } from "../lib/http.js";
import { apiUrl, getApiBase } from "../src/api-client.js";

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end() {
      this.ended = true;
    },
  };
}

test("prepare allows Capacitor WebView origins and answers OPTIONS preflight", () => {
  for (const origin of [
    "https://localhost",
    "http://localhost",
    "capacitor://localhost",
  ]) {
    const preflightRes = mockResponse();
    const handled = prepare(
      {
        method: "OPTIONS",
        headers: {
          host: "vtopia-chennai.vercel.app",
          origin,
          "sec-fetch-site": "cross-site",
        },
      },
      preflightRes,
      "POST",
    );
    assert.equal(handled, true);
    assert.equal(preflightRes.statusCode, 204);
    assert.equal(preflightRes.ended, true);
    assert.equal(preflightRes.headers["Access-Control-Allow-Origin"], origin);
    assert.equal(
      preflightRes.headers["Access-Control-Allow-Methods"],
      "POST, OPTIONS",
    );
    assert.equal(
      preflightRes.headers["Access-Control-Allow-Headers"],
      "Content-Type",
    );

    const postRes = mockResponse();
    const stop = prepare(
      {
        method: "POST",
        headers: {
          host: "vtopia-chennai.vercel.app",
          origin,
          "sec-fetch-site": "cross-site",
        },
      },
      postRes,
      "POST",
    );
    assert.equal(stop, false);
    assert.equal(postRes.headers["Access-Control-Allow-Origin"], origin);
  }
});

test("prepare rejects untrusted third-party cross-site and preflight requests", () => {
  assert.throws(
    () =>
      prepare(
        {
          method: "OPTIONS",
          headers: {
            host: "vtopia-chennai.vercel.app",
            origin: "https://untrusted.example",
          },
        },
        mockResponse(),
        "POST",
      ),
    { code: "FORBIDDEN" },
  );

  assert.throws(
    () =>
      prepare(
        {
          method: "POST",
          headers: {
            host: "vtopia-chennai.vercel.app",
            origin: "https://untrusted.example",
            "sec-fetch-site": "cross-site",
          },
        },
        mockResponse(),
        "POST",
      ),
    { code: "FORBIDDEN" },
  );
});

test("apiUrl targets vtopia-chennai.vercel.app inside native Capacitor and stays relative on web", () => {
  assert.equal(getApiBase(), "");
  assert.equal(apiUrl("/api/captcha"), "/api/captcha");

  const originalWindow = globalThis.window;
  globalThis.window = {
    Capacitor: {
      isNativePlatform: () => true,
    },
  };
  try {
    assert.equal(getApiBase(), "https://vtopia-chennai.vercel.app");
    assert.equal(
      apiUrl("/api/sync"),
      "https://vtopia-chennai.vercel.app/api/sync",
    );
  } finally {
    globalThis.window = originalWindow;
  }
});
