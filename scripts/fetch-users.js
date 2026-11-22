#!/usr/bin/env node
/**
 * Vtopia Admin CLI - Student User Database Fetcher & Exporter
 *
 * Fetches all student login telemetry from the Vtopia API (remote or localhost),
 * merges with the local persistent database at .data/vtopia_users.json,
 * exports .data/users_export.csv, and prints a summary table to the console.
 *
 * Usage:
 *   node scripts/fetch-users.js
 *   node scripts/fetch-users.js --url https://your-app.vercel.app
 *   npm run admin:users
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, ".data");
const LOCAL_DB_PATH = path.join(DATA_DIR, "vtopia_users.json");
const EXPORT_CSV_PATH = path.join(DATA_DIR, "users_export.csv");

const DEFAULT_PIN = "27112006";
const CANDIDATE_URLS = [
  process.env.ADMIN_API_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  "https://vtopia-chennai.vercel.app",
  "http://127.0.0.1:5184",
  "http://localhost:5184",
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    pin: process.env.ADMIN_PIN || DEFAULT_PIN,
    rawJson: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--url" || arg === "-u") {
      options.url = args[++i];
    } else if (arg === "--pin" || arg === "-p") {
      options.pin = args[++i];
    } else if (arg === "--json") {
      options.rawJson = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (!arg.startsWith("-") && !options.url) {
      options.url = arg;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Vtopia Admin CLI - User Database Manager

Usage:
  npm run admin:users [options]
  node scripts/fetch-users.js [options]

Options:
  --url, -u <url>   API base URL (default: checks localhost:5184, 5173, 3000)
  --pin, -p <pin>   Admin PIN (default: 27112006)
  --json            Print raw JSON output instead of ASCII table
  --help, -h        Show this help message

Examples:
  npm run admin:users
  npm run admin:users -- --url https://vtopia.vercel.app
  node scripts/fetch-users.js --url https://vtopia.vercel.app
`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readLocalDb() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.users)) return parsed.users;
    }
  } catch (err) {
    console.warn(`[WARN] Could not read local DB (${LOCAL_DB_PATH}): ${err.message}`);
  }
  return [];
}

function mergeUsers(existingList = [], incomingList = []) {
  // If remote provided fresh data, remote is the single source of truth
  const listToUse = (incomingList && incomingList.length > 0) ? incomingList : existingList;
  const map = new Map();

  const isOfficialReg = (r) => /^[0-9]{2}[A-Z]{3}[0-9]{4}$/i.test(r || "");

  function findExistingKey(u) {
    const regKey = (u.regNo || "").trim().toUpperCase();
    const nameKey = (u.name || "").trim().toUpperCase();

    if (regKey && map.has(regKey)) return regKey;
    if (nameKey && map.has(nameKey)) return nameKey;

    // Check if any existing entry has matching name or registration
    for (const [k, v] of map.entries()) {
      const vName = (v.name || "").trim().toUpperCase();
      const vReg = (v.regNo || "").trim().toUpperCase();

      if (regKey && vReg === regKey) return k;
      if (nameKey && vName === nameKey) return k;

      // Smart match: check username patterns like KAILASH1382 vs KAILASH P / 24BRS1382
      if (
        (nameKey && vName.includes(nameKey)) ||
        (nameKey && nameKey.includes(vName)) ||
        (regKey && vReg.includes(regKey.slice(-4)))
      ) {
        return k;
      }
    }
    return null;
  }

  for (const u of listToUse) {
    const name = (u.name || "").trim();
    const regNo = (u.regNo || "").trim().toUpperCase();
    if (!name && !regNo) continue;

    const matchedKey = findExistingKey(u);

    if (matchedKey) {
      const prev = map.get(matchedKey);
      const prevActive = new Date(prev.lastActive || 0).getTime();
      const incActive = new Date(u.lastActive || 0).getTime();
      const prevFirst = new Date(prev.firstSeen || Date.now()).getTime();
      const incFirst = new Date(u.firstSeen || Date.now()).getTime();

      // Prefer official registration number over username
      const preferredReg = isOfficialReg(regNo) ? regNo : (isOfficialReg(prev.regNo) ? prev.regNo : (regNo || prev.regNo));
      const preferredName = (name && name.length >= (prev.name || "").length) ? name : (prev.name || name);
      const targetKey = preferredReg || preferredName.toUpperCase();

      const merged = {
        name: preferredName,
        regNo: preferredReg,
        firstSeen: new Date(Math.min(prevFirst, incFirst)).toISOString(),
        lastActive: new Date(Math.max(prevActive, incActive)).toISOString(),
        // Keep true count from remote rather than doubling
        loginCount: Math.max(prev.loginCount || 1, u.loginCount || 1),
        platform: u.platform || prev.platform || "Web",
        version: u.version || prev.version || "1.2.0",
      };

      if (matchedKey !== targetKey) {
        map.delete(matchedKey);
      }
      map.set(targetKey, merged);
    } else {
      const targetKey = regNo || name.toUpperCase();
      map.set(targetKey, {
        name: name || "Unknown Student",
        regNo: regNo || "",
        firstSeen: u.firstSeen || u.lastActive || new Date().toISOString(),
        lastActive: u.lastActive || new Date().toISOString(),
        loginCount: Number(u.loginCount) || 1,
        platform: u.platform || "Web",
        version: u.version || "1.2.0",
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime(),
  );
}

function saveLocalDb(users) {
  ensureDir(DATA_DIR);
  const payload = {
    updatedAt: new Date().toISOString(),
    totalUsers: users.length,
    totalLogins: users.reduce((sum, u) => sum + (Number(u.loginCount) || 1), 0),
    users,
  };
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(payload, null, 2), "utf8");
}

function saveCsv(users) {
  ensureDir(DATA_DIR);
  const headers = ["Index", "Name", "Registration Number", "Login Count", "Platform", "First Seen", "Last Active", "App Version"];
  const rows = users.map((u, i) => [
    i + 1,
    `"${(u.name || "").replace(/"/g, '""')}"`,
    `"${(u.regNo || "").replace(/"/g, '""')}"`,
    u.loginCount || 1,
    `"${(u.platform || "").replace(/"/g, '""')}"`,
    `"${u.firstSeen || ""}"`,
    `"${u.lastActive || ""}"`,
    `"${u.version || ""}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  fs.writeFileSync(EXPORT_CSV_PATH, csvContent, "utf8");
}

async function fetchFromUrl(baseUrl, pin) {
  const cleanBase = baseUrl.trim().replace(/\/+$/, "").replace(/\/api\/admin\/?$/, "");
  const endpoint = `${cleanBase}/api/admin`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    // Try "export" action first (modern full schema)
    const res = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action: "export", pin }),
    });

    if (res.ok) {
      clearTimeout(timeout);
      const data = await res.json();
      return { ok: true, source: cleanBase, data };
    }

    // Fallback to "list" action if older server running in memory
    const listRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action: "list", pin }),
    });
    clearTimeout(timeout);

    if (listRes.ok) {
      const data = await listRes.json();
      return { ok: true, source: cleanBase, data };
    }

    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, source: cleanBase, error: err.message };
  }
}

function formatRelative(isoDate) {
  if (!isoDate) return "Never";
  const diff = Date.now() - new Date(isoDate).getTime();
  if (diff < 60 * 1000) return "Just now";
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoDate).toISOString().slice(0, 10);
}

function getStatusBadge(isoDate) {
  if (!isoDate) return "OFFLINE";
  const diff = Date.now() - new Date(isoDate).getTime();
  if (diff < 30 * 60 * 1000) return "\x1b[32mONLINE\x1b[0m"; // Green
  if (diff < 24 * 60 * 60 * 1000) return "\x1b[33mTODAY\x1b[0m"; // Yellow
  return "\x1b[90mOFFLINE\x1b[0m"; // Gray
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const existingLocalUsers = readLocalDb();
  let fetchedUsers = [];
  let successfulSource = null;

  const targetUrls = options.url ? [options.url] : CANDIDATE_URLS;

  if (options.url) {
    console.log(`Connecting to: ${options.url} (PIN: ${options.pin ? "••••••••" : "none"})`);
  }

  for (const targetUrl of targetUrls) {
    const res = await fetchFromUrl(targetUrl, options.pin);
    if (res.ok && res.data) {
      successfulSource = res.source;
      const incoming = Array.isArray(res.data) ? res.data : res.data.users || [];
      fetchedUsers = incoming;
      break;
    }
  }

  // If a specified options.url failed, try local server as fallback so user still gets live data
  if (!successfulSource && options.url) {
    for (const localUrl of CANDIDATE_URLS) {
      if (localUrl === options.url) continue;
      const res = await fetchFromUrl(localUrl, options.pin);
      if (res.ok && res.data) {
        successfulSource = `${res.source} (local fallback)`;
        const incoming = Array.isArray(res.data) ? res.data : res.data.users || [];
        fetchedUsers = incoming;
        break;
      }
    }
  }

  const mergedUsers = mergeUsers(existingLocalUsers, fetchedUsers);
  saveLocalDb(mergedUsers);
  saveCsv(mergedUsers);

  if (options.rawJson) {
    console.log(JSON.stringify({ total: mergedUsers.length, users: mergedUsers }, null, 2));
    return;
  }

  console.log("\n=======================================================");
  console.log("            VTOPIA - STUDENT LOGIN DATABASE           ");
  console.log("=======================================================\n");

  if (successfulSource) {
    console.log(`\x1b[32m✔ Synchronized with:\x1b[0m ${successfulSource}`);
  } else if (options.url) {
    console.log(`\x1b[31m✖ Remote connection failed:\x1b[0m Could not connect to ${options.url}`);
    if (options.url.includes("your-vtopia-url") || options.url.includes("example.com")) {
      console.log(`\x1b[33m💡 Note: "${options.url}" is a placeholder! Replace it with your actual Vercel URL, or run without --url to use your local server.\x1b[0m`);
    }
    console.log(`\x1b[33mℹ Loaded existing local database records.\x1b[0m`);
  } else {
    console.log(`\x1b[33mℹ Local offline mode\x1b[0m (Reading from ${path.relative(ROOT_DIR, LOCAL_DB_PATH)})`);
  }

  const now = Date.now();
  const activeTodayCount = mergedUsers.filter(
    (u) => now - new Date(u.lastActive).getTime() < 24 * 60 * 60 * 1000,
  ).length;
  const totalLogins = mergedUsers.reduce((sum, u) => sum + (Number(u.loginCount) || 1), 0);

  console.log(`\n  Total Students Ever Logged In: \x1b[1m\x1b[36m${mergedUsers.length}\x1b[0m`);
  console.log(`  Active In Last 24 Hours:        \x1b[1m\x1b[32m${activeTodayCount}\x1b[0m`);
  console.log(`  Total Recorded Syncs:          \x1b[1m\x1b[35m${totalLogins}\x1b[0m`);
  console.log(`  Local Database Path:           ${path.relative(ROOT_DIR, LOCAL_DB_PATH)}`);
  console.log(`  Spreadsheet Export:            ${path.relative(ROOT_DIR, EXPORT_CSV_PATH)}\n`);

  if (mergedUsers.length === 0) {
    console.log("No student logins recorded yet.");
    console.log("Once a student logs into the app or web, their telemetry will appear here.\n");
    return;
  }

  console.log("--------------------------------------------------------------------------------------------------");
  console.log(
    ` ${"#".padEnd(4)} | ${"STUDENT NAME".padEnd(24)} | ${"REG NO".padEnd(12)} | ${"LOGINS".padEnd(6)} | ${"PLATFORM".padEnd(12)} | ${"LAST ACTIVE".padEnd(12)} | STATUS`,
  );
  console.log("--------------------------------------------------------------------------------------------------");

  mergedUsers.forEach((u, i) => {
    const idx = String(i + 1).padEnd(4);
    const name = (u.name || "Unknown").slice(0, 24).padEnd(24);
    const regNo = (u.regNo || "—").slice(0, 12).padEnd(12);
    const logins = String(u.loginCount || 1).padEnd(6);
    const platform = (u.platform || "Web").slice(0, 12).padEnd(12);
    const lastActive = formatRelative(u.lastActive).padEnd(12);
    const status = getStatusBadge(u.lastActive);

    console.log(` ${idx} | ${name} | ${regNo} | ${logins} | ${platform} | ${lastActive} | ${status}`);
  });

  console.log("--------------------------------------------------------------------------------------------------\n");
  console.log(`Saved ${mergedUsers.length} student records locally to .data/vtopia_users.json and .data/users_export.csv\n`);
}

main().catch((err) => {
  console.error("\x1b[31mError running fetch-users:\x1b[0m", err);
  process.exit(1);
});
