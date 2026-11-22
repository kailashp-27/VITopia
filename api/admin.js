import { prepare, readBody, sendError } from "../lib/http.js";
import { AppError } from "../lib/errors.js";
import { promises as fs } from "node:fs";
import path from "node:path";

export const ADMIN_PIN = "27112006";

const usersStore = new Map();

const USERS_FILE = process.env.VERCEL
  ? "/tmp/vtopia_users.json"
  : path.resolve(".data", "vtopia_users.json");

const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const firebaseUrl = process.env.FIREBASE_DATABASE_URL;
const redisUrl = process.env.REDIS_URL;

let redisClientPromise = null;
async function getRedisClient() {
  if (!redisUrl) return null;
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const { createClient } = await import("@redis/client");
        const client = createClient({ url: redisUrl });
        client.on("error", (err) => console.warn("[Redis client error]", err?.message || err));
        await client.connect();
        return client;
      } catch (err) {
        console.warn("[Redis connection failed]", err?.message || err);
        return null;
      }
    })();
  }
  return redisClientPromise;
}

export async function loadStore(store, loadRemote = (store === usersStore)) {
  if (!loadRemote) return;

  // 1. Try Firebase Realtime Database (if configured)
  if (firebaseUrl) {
    try {
      const cleanUrl = firebaseUrl.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/vtopia_users.json`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === "object") {
          const items = Array.isArray(data) ? data : Object.values(data);
          for (const u of items) {
            if (u && (u.name || u.regNo)) {
              const k = (u.regNo || u.name).toLowerCase().trim();
              store.set(k, { ...u, id: k });
            }
          }
        }
      }
    } catch {}
  }

  // 2. Try Upstash Redis / Vercel KV REST (if configured)
  if (kvUrl && kvToken) {
    try {
      const cleanUrl = kvUrl.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/get/vtopia_users`, {
        headers: { Authorization: `Bearer ${kvToken}` },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        let arr = data?.result;
        if (typeof arr === "string") {
          try {
            arr = JSON.parse(arr);
          } catch {}
        }
        if (Array.isArray(arr)) {
          for (const u of arr) {
            if (u && (u.name || u.regNo)) {
              const k = (u.regNo || u.name).toLowerCase().trim();
              store.set(k, { ...u, id: k });
            }
          }
        }
      }
    } catch {}
  }

  // 3. Try Native Redis (REDIS_URL, e.g. rediss://...)
  try {
    const client = await getRedisClient();
    if (client) {
      const raw = await client.get("vtopia_users");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const u of arr) {
            if (u && (u.name || u.regNo)) {
              const k = (u.regNo || u.name).toLowerCase().trim();
              store.set(k, { ...u, id: k });
            }
          }
        }
      }
    }
  } catch {}

  // 3. Always merge from local disk store (e.g. .data/vtopia_users.json on localhost or /tmp on serverless)
  try {
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      for (const u of arr) {
        if (u && (u.name || u.regNo)) {
          const k = (u.regNo || u.name).toLowerCase().trim();
          const existing = store.get(k);
          if (!existing) {
            store.set(k, { ...u, id: k });
          } else {
            // Merge: preserve earliest firstSeen, latest lastActive, max loginCount
            store.set(k, {
              ...existing,
              ...u,
              id: k,
              firstSeen:
                new Date(existing.firstSeen || 0) < new Date(u.firstSeen || 0)
                  ? existing.firstSeen || u.firstSeen
                  : u.firstSeen || existing.firstSeen,
              lastActive:
                new Date(existing.lastActive || 0) > new Date(u.lastActive || 0)
                  ? existing.lastActive
                  : u.lastActive,
              loginCount: Math.max(
                existing.loginCount || 1,
                u.loginCount || 1,
              ),
            });
          }
        }
      }
    }
  } catch {}
}

export async function saveStore(store, saveRemote = (store === usersStore)) {
  if (!saveRemote) return;
  const arr = Array.from(store.values());

  // 1. Save to Firebase (if configured)
  if (firebaseUrl) {
    try {
      const cleanUrl = firebaseUrl.replace(/\/$/, "");
      await fetch(`${cleanUrl}/vtopia_users.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arr),
        signal: AbortSignal.timeout(4000),
      });
    } catch {}
  }

  // 2. Save to KV / Redis (if configured)
  if (kvUrl && kvToken) {
    try {
      const cleanUrl = kvUrl.replace(/\/$/, "");
      await fetch(`${cleanUrl}/set/vtopia_users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kvToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(arr),
        signal: AbortSignal.timeout(4000),
      });
    } catch {}
  }

  // 3. Save to Native Redis (REDIS_URL, e.g. rediss://...)
  try {
    const client = await getRedisClient();
    if (client) {
      await client.set("vtopia_users", JSON.stringify(arr));
    }
  } catch {}

  // 3. Always persist to disk
  try {
    await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
    await fs.writeFile(USERS_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch {}
}

export function createAdminHandler(store = usersStore) {
  return async (req, res) => {
    try {
      if (prepare(req, res, "POST")) return;
      await loadStore(store);
      const body = await readBody(req);
      const action = body?.action;

      if (action === "ping") {
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const regNo =
          typeof body?.regNo === "string" ? body.regNo.trim().toUpperCase() : "";

        if (!name && !regNo) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false }));
          return;
        }

        const key = (regNo || name).toLowerCase();
        
        // Find existing record by regNo, name, or username prefix
        let existingKey = null;
        if (store.has(key)) {
          existingKey = key;
        } else {
          for (const [k, v] of store.entries()) {
            const vReg = (v.regNo || "").toLowerCase().trim();
            const vName = (v.name || "").toLowerCase().trim();
            const currentReg = regNo.toLowerCase().trim();
            const currentName = name.toLowerCase().trim();

            if (
              (vReg && currentReg && vReg === currentReg) ||
              (vName && currentName && vName === currentName) ||
              (currentReg && vName.includes(currentReg)) ||
              (vReg && currentName.includes(vReg))
            ) {
              existingKey = k;
              break;
            }
          }
        }

        const existing = existingKey ? store.get(existingKey) : null;
        if (existingKey && existingKey !== key) {
          store.delete(existingKey);
        }

        // Prefer official registration format (e.g. 24BRS1382 over KAILASH1382)
        const isOfficialReg = (r) => /^[0-9]{2}[A-Z]{3}[0-9]{4}$/i.test(r || "");
        let finalRegNo = regNo || existing?.regNo || "";
        if (existing?.regNo && isOfficialReg(existing.regNo) && !isOfficialReg(regNo)) {
          finalRegNo = existing.regNo;
        }

        let finalName = name || existing?.name || "Student";
        if (existing?.name && existing.name.length > finalName.length) {
          finalName = existing.name;
        }

        const finalKey = (finalRegNo || finalName).toLowerCase();

        const record = {
          id: finalKey,
          name: finalName,
          regNo: finalRegNo,
          firstSeen: existing?.firstSeen || new Date().toISOString(),
          lastActive: new Date().toISOString(),
          loginCount: (existing?.loginCount || 0) + 1,
          platform: body?.isApp ? "Android App" : existing?.platform || "Web",
          version: body?.version || existing?.version || "1.2.0",
        };

        store.set(finalKey, record);
        await saveStore(store);

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (action === "list") {
        if (body?.pin !== ADMIN_PIN) {
          throw new AppError("FORBIDDEN", "Invalid admin PIN.", 403);
        }
        const list = Array.from(store.values()).sort(
          (a, b) => new Date(b.lastActive) - new Date(a.lastActive),
        );
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const activeToday = list.filter(
          (u) => now - new Date(u.lastActive).getTime() < oneDayMs,
        ).length;
        const totalLogins = list.reduce(
          (acc, u) => acc + (u.loginCount || 1),
          0,
        );

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            success: true,
            total: list.length,
            activeToday,
            totalLogins,
            users: list,
          }),
        );
        return;
      }

      if (action === "export") {
        if (body?.pin !== ADMIN_PIN) {
          throw new AppError("FORBIDDEN", "Invalid admin PIN.", 403);
        }
        const list = Array.from(store.values()).sort(
          (a, b) => new Date(b.lastActive) - new Date(a.lastActive),
        );
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            success: true,
            exportedAt: new Date().toISOString(),
            total: list.length,
            users: list,
          }),
        );
        return;
      }

      if (action === "delete") {
        if (body?.pin !== ADMIN_PIN) {
          throw new AppError("FORBIDDEN", "Invalid admin PIN.", 403);
        }
        const target = (body?.regNo || body?.name || body?.id || "").toLowerCase().trim();
        if (!target) {
          throw new AppError("BAD_REQUEST", "Registration number or name required to delete.", 400);
        }
        let deleted = false;
        for (const [key, val] of Array.from(store.entries())) {
          if (
            key === target ||
            (val.regNo && val.regNo.toLowerCase().trim() === target) ||
            (val.name && val.name.toLowerCase().trim() === target)
          ) {
            store.delete(key);
            deleted = true;
          }
        }
        if (deleted) {
          await saveStore(store);
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, deleted, total: store.size }));
        return;
      }

      if (action === "clear") {
        if (body?.pin !== ADMIN_PIN) {
          throw new AppError("FORBIDDEN", "Invalid admin PIN.", 403);
        }
        store.clear();
        await saveStore(store);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, count: 0, users: [] }));
        return;
      }

      throw new AppError("BAD_REQUEST", "Unsupported admin action.", 400);
    } catch (error) {
      sendError(res, error);
    }
  };
}

export default createAdminHandler();
