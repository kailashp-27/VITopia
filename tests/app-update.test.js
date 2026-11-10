import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_APK_DOWNLOAD_URL,
  checkForAppUpdate,
  isNewerAppVersion,
  parseAppUpdateManifest,
  sanitizeDownloadUrl,
} from "../src/app-update.js";

test("isNewerAppVersion compares integer versionCodes strictly", () => {
  assert.equal(isNewerAppVersion({ versionCode: 4 }, 3), true);
  assert.equal(isNewerAppVersion({ versionCode: 3 }, 3), false);
  assert.equal(isNewerAppVersion({ versionCode: 2 }, 3), false);
  assert.equal(isNewerAppVersion({ versionCode: "4" }, 3), true);
  assert.equal(isNewerAppVersion({ versionCode: 0 }, 3), false);
  assert.equal(isNewerAppVersion({ versionCode: null }, 3), false);
  assert.equal(isNewerAppVersion({ versionCode: 4 }, null), false);
});

test("sanitizeDownloadUrl allows only https URLs and defaults safely", () => {
  assert.equal(
    sanitizeDownloadUrl(
      "https://github.com/kailashp-27/VITopia/releases/download/v1.1.0/Vtopia.apk",
    ),
    "https://github.com/kailashp-27/VITopia/releases/download/v1.1.0/Vtopia.apk",
  );
  assert.equal(
    sanitizeDownloadUrl("javascript:alert(1)"),
    DEFAULT_APK_DOWNLOAD_URL,
  );
  assert.equal(
    sanitizeDownloadUrl("http://example.com/app.apk"),
    DEFAULT_APK_DOWNLOAD_URL,
  );
  assert.equal(sanitizeDownloadUrl(""), DEFAULT_APK_DOWNLOAD_URL);
});

test("parseAppUpdateManifest normalizes update payload", () => {
  const result = parseAppUpdateManifest(
    {
      versionCode: 4,
      versionName: "1.2.0",
      downloadUrl: "https://vtopia-chennai.vercel.app/Vtopia.apk",
      releaseNotes: "Smart class notifications",
    },
    3,
  );
  assert.deepEqual(result, {
    available: true,
    versionCode: 4,
    versionName: "1.2.0",
    downloadUrl: "https://vtopia-chennai.vercel.app/Vtopia.apk",
    releaseNotes: "Smart class notifications",
  });
  assert.equal(parseAppUpdateManifest({}, 3), null);
});

test("checkForAppUpdate returns parsed status and handles failures quietly", async () => {
  const newer = await checkForAppUpdate({
    currentVersionCode: 3,
    manifestUrl: "https://vtopia-chennai.vercel.app/app-version.json",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        versionCode: 4,
        versionName: "1.2.0",
        downloadUrl: "https://github.com/kailashp-27/VITopia/releases/latest",
      }),
    }),
  });
  assert.equal(newer?.available, true);
  assert.equal(newer?.versionName, "1.2.0");

  const upToDate = await checkForAppUpdate({
    currentVersionCode: 3,
    manifestUrl: "https://vtopia-chennai.vercel.app/app-version.json",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        versionCode: 3,
        versionName: "1.1.0",
      }),
    }),
  });
  assert.equal(upToDate?.available, false);

  const failed = await checkForAppUpdate({
    currentVersionCode: 3,
    manifestUrl: "https://vtopia-chennai.vercel.app/app-version.json",
    fetchImpl: async () => {
      throw new Error("Offline");
    },
  });
  assert.equal(failed, null);
});
