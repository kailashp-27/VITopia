import { apiUrl } from "./api-client.js";

export const APP_MANIFEST_PATH = "/app-version.json";
export const DEFAULT_APK_DOWNLOAD_URL =
  "https://github.com/kailashp-27/VITopia/releases/latest";

function parsePositiveInt(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

export function sanitizeDownloadUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return DEFAULT_APK_DOWNLOAD_URL;
  }
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {}
  return DEFAULT_APK_DOWNLOAD_URL;
}

export function isNewerAppVersion(remoteManifest, currentVersionCode) {
  const remoteCode = parsePositiveInt(remoteManifest?.versionCode);
  const currentCode = parsePositiveInt(currentVersionCode);
  if (remoteCode === null || currentCode === null) return false;
  return remoteCode > currentCode;
}

export function parseAppUpdateManifest(payload, currentVersionCode) {
  if (!payload || typeof payload !== "object") return null;
  const versionCode = parsePositiveInt(payload.versionCode);
  if (versionCode === null) return null;

  const versionName =
    typeof payload.versionName === "string" && payload.versionName.trim()
      ? payload.versionName.trim()
      : `${versionCode}`;
  const releaseNotes =
    typeof payload.releaseNotes === "string"
      ? payload.releaseNotes.trim()
      : "";

  return {
    available: isNewerAppVersion(payload, currentVersionCode),
    versionCode,
    versionName,
    downloadUrl: sanitizeDownloadUrl(payload.downloadUrl),
    releaseNotes,
  };
}

export async function checkForAppUpdate({
  currentVersionCode,
  manifestUrl = apiUrl(APP_MANIFEST_PATH),
  fetchImpl = globalThis.fetch,
  signal,
} = {}) {
  const currentCode = parsePositiveInt(currentVersionCode);
  if (currentCode === null || typeof fetchImpl !== "function") {
    return null;
  }
  try {
    const response = await fetchImpl(manifestUrl, {
      cache: "no-store",
      signal,
    });
    if (!response?.ok) return null;
    const payload = await response.json();
    return parseAppUpdateManifest(payload, currentCode);
  } catch {
    return null;
  }
}
