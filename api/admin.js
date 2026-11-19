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

let loaded = false;

async function loadStore(store) {
  if (loaded) return;
  if (kvUrl && kvToken) {
    try {
      const res = await fetch(`${kvUrl.replace(/\/$/, "")}/get/vtopia_users`, {
        headers: { Authorization: `Bearer ${kvToken}` },
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
            if (u && u.name) store.set(u.name.toLowerCase().trim(), u);
          }
          loaded = true;
          return;
        }
      }
    } catch {}
  }

  try {
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      for (const u of arr) {
        if (u && u.name) store.set(u.name.toLowerCase().trim(), u);
      }
    }
  } catch {}
  loaded = true;
}

async function saveStore(store) {
  const arr = Array.from(store.values());
  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl.replace(/\/$/, "")}/set/vtopia_users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kvToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(arr),
      });
    } catch {}
  }

  try {
    await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
    await fs.writeFile(USERS_FILE, JSON.stringify(arr), "utf-8");
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
        const name = body?.name;
        if (!name || typeof name !== "string" || !name.trim()) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false }));
          return;
        }
        const cleanName = name.trim();
        const key = cleanName.toLowerCase();
        const existing = store.get(key);
        const record = {
          name: cleanName,
          firstSeen: existing?.firstSeen || new Date().toISOString(),
          lastActive: new Date().toISOString(),
        };
        store.set(key, record);
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

        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            success: true,
            total: list.length,
            activeToday,
            users: list,
          }),
        );
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
