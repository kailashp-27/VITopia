// Friendly Timetable Sharing & Comparison
const STORAGE_KEY_PREFIX = "vtopia_saved_friends";

function getStorageKey(accountKey = "") {
  const normalized = (accountKey || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  return normalized ? `${STORAGE_KEY_PREFIX}_${normalized}` : STORAGE_KEY_PREFIX;
}

export const DAYS_OF_WEEK = ["MON", "TUE", "WED", "THU", "FRI"];

export const PERIODS = [
  { id: 1, label: "P1", start: "08:00", end: "08:50", startMin: 480, endMin: 530 },
  { id: 2, label: "P2", start: "08:55", end: "09:45", startMin: 535, endMin: 585 },
  { id: 3, label: "P3", start: "09:50", end: "10:40", startMin: 590, endMin: 640 },
  { id: 4, label: "P4", start: "10:45", end: "11:35", startMin: 645, endMin: 695 },
  { id: 5, label: "P5", start: "11:40", end: "12:30", startMin: 700, endMin: 750 },
  { id: 6, label: "P6", start: "12:35", end: "13:20", startMin: 755, endMin: 800 },
  // Lunch break 13:20 - 14:00 is ignored
  { id: 7, label: "P7", start: "14:00", end: "14:50", startMin: 840, endMin: 890 },
  { id: 8, label: "P8", start: "14:55", end: "15:45", startMin: 895, endMin: 945 },
  { id: 9, label: "P9", start: "15:50", end: "16:40", startMin: 950, endMin: 1000 },
  { id: 10, label: "P10", start: "16:45", end: "17:35", startMin: 1005, endMin: 1055 },
  { id: 11, label: "P11", start: "17:40", end: "18:30", startMin: 1060, endMin: 1110 },
  { id: 12, label: "P12", start: "18:35", end: "19:25", startMin: 1115, endMin: 1165 },
];

export const FRIEND_COLORS = [
  { name: "Orange", hex: "#f59e0b", badge: "#d97706", light: "rgba(245, 158, 11, 0.16)", text: "#fbbf24" },
  { name: "Cyan", hex: "#06b6d4", badge: "#0891b2", light: "rgba(6, 182, 212, 0.16)", text: "#22d3ee" },
  { name: "Emerald", hex: "#10b981", badge: "#059669", light: "rgba(16, 185, 129, 0.16)", text: "#34d399" },
  { name: "Rose", hex: "#f43f5e", badge: "#e11d48", light: "rgba(244, 63, 94, 0.16)", text: "#fb7185" },
  { name: "Purple", hex: "#a855f7", badge: "#7e22ce", light: "rgba(168, 85, 247, 0.16)", text: "#c084fc" },
];

function toMin(time) {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function getClassForPeriod(classes = [], day, period) {
  const dayUpper = (day || "").toUpperCase();
  const dayClasses = (classes || []).filter(
    (c) => (c.day || "").toUpperCase().slice(0, 3) === dayUpper,
  );
  return (
    dayClasses.find((c) => {
      const cStart = toMin(c.start);
      const cEnd = toMin(c.end);
      const overlap = Math.min(cEnd, period.endMin) - Math.max(cStart, period.startMin);
      return overlap >= 25;
    }) || null
  );
}

export function encodeTimetableShare(name, regNoOrClasses = [], maybeClasses = []) {
  let regNo = "";
  let classes = [];
  if (Array.isArray(regNoOrClasses)) {
    classes = regNoOrClasses;
  } else {
    regNo = regNoOrClasses || "";
    classes = maybeClasses || [];
  }

  // Deduplicate courses to keep payload super compact for QR codes
  const courseMap = new Map();
  const courses = [];
  const items = [];
  for (const c of classes) {
    const code = c.code || "";
    const title = (c.title || "").slice(0, 24);
    const venue = c.venue || "";
    const key = `${code}|${venue}`;
    let idx = courseMap.get(key);
    if (idx === undefined) {
      idx = courses.length;
      courseMap.set(key, idx);
      courses.push([code, title, venue]);
    }
    items.push([
      idx,
      (c.day || "").toUpperCase().slice(0, 3),
      c.start || "",
      c.end || "",
      c.slot || "",
    ]);
  }

  const payload = {
    v: 2,
    n: (name || "Student").trim(),
    r: (regNo || "").trim(),
    k: courses,
    s: items,
  };

  const json = JSON.stringify(payload);
  let base64 = "";
  if (typeof btoa !== "undefined") {
    base64 = btoa(unescape(encodeURIComponent(json)));
  } else {
    base64 = Buffer.from(json).toString("base64");
  }
  return `vtopia:tt:${base64}`;
}

function tryDecodeBase64Json(token) {
  let raw = (token || "").replace(/-/g, "+").replace(/_/g, "/");
  while (raw.length % 4 !== 0) raw += "=";
  const json =
    typeof atob !== "undefined"
      ? decodeURIComponent(escape(atob(raw)))
      : Buffer.from(raw, "base64").toString("utf-8");
  return JSON.parse(json);
}

export function decodeTimetableShare(code) {
  if (!code || typeof code !== "string") return null;
  try {
    const trimmed = code.trim();
    let data = null;

    // 1. Extract contiguous vtopia:tt:<base64> token
    const directMatch = trimmed.match(/vtopia:tt:([A-Za-z0-9+/=_-]+)/i);
    if (directMatch) {
      try {
        data = tryDecodeBase64Json(directMatch[1]);
      } catch {
        // Fallback if token was line-wrapped across newlines
        const unwrapped = trimmed.replace(/[\r\n]+\s*/g, "");
        const unwrappedMatch = unwrapped.match(/vtopia:tt:([A-Za-z0-9+/=_-]+)/i);
        if (unwrappedMatch) {
          data = tryDecodeBase64Json(unwrappedMatch[1]);
        }
      }
    } else if (trimmed.startsWith("{")) {
      data = JSON.parse(trimmed);
    } else {
      data = tryDecodeBase64Json(trimmed.replace(/\s+/g, ""));
    }

    if (!data) return null;

    // Format v2 (deduplicated courses)
    if (data.v === 2 && Array.isArray(data.k) && Array.isArray(data.s)) {
      return {
        name: data.n || "Friend",
        regNo: data.r || "",
        classes: data.s.map(([idx, day, start, end, slot]) => {
          const [courseCode, title, venue] = data.k[idx] || ["", "", ""];
          return {
            code: courseCode,
            title: title || courseCode,
            day: (day || "").toUpperCase().slice(0, 3),
            start: start || "",
            end: end || "",
            slot: slot || "",
            venue: venue || "",
            type: courseCode.endsWith("P") ? "Lab" : "Theory",
          };
        }),
      };
    }

    // Format v1 or raw array of classes
    if (Array.isArray(data.classes)) {
      return {
        name: data.name || "Friend",
        regNo: data.regNo || data.registration || "",
        classes: data.classes.map((c) => ({
          code: c.c || c.code || "",
          title: c.t || c.title || "",
          day: (c.d || c.day || "").toUpperCase().slice(0, 3),
          start: c.s || c.start || "",
          end: c.e || c.end || "",
          slot: c.sl || c.slot || "",
          venue: c.v || c.venue || "",
          type: c.tp || c.type || "Course",
        })),
      };
    }

    return null;
  } catch (e) {
    return null;
  }
}

export function compareTimetables(myClasses = [], friendClasses = [], day = "MON") {
  const myDay = (myClasses || [])
    .filter((c) => (c.day || "").toUpperCase() === day.toUpperCase())
    .sort((a, b) => a.start.localeCompare(b.start));
  const friendDay = (friendClasses || [])
    .filter((c) => (c.day || "").toUpperCase() === day.toUpperCase())
    .sort((a, b) => a.start.localeCompare(b.start));

  const toMinutes = (clock) => {
    if (!clock) return 0;
    const [h, m] = clock.split(":").map(Number);
    return h * 60 + m;
  };

  // Find shared courses/slots
  const norm = (v) => (v || "").trim().toUpperCase();
  const sharedClasses = [];
  for (const mine of myDay) {
    const matchingFriendClass = friendDay.find(
      (f) =>
        norm(f.code) === norm(mine.code) &&
        f.start === mine.start,
    );
    if (matchingFriendClass) {
      const myVenue = norm(mine.venue);
      const friendVenue = norm(matchingFriendClass.venue);
      sharedClasses.push({
        course: mine.title || mine.code,
        code: mine.code,
        start: mine.start,
        end: mine.end,
        venue: mine.venue || matchingFriendClass.venue,
        friendVenue: matchingFriendClass.venue || "",
        sameVenue: Boolean(myVenue && friendVenue && myVenue === friendVenue),
      });
    }
  }

  // Find common free slots between 08:00 (480 mins) and 18:00 (1080 mins)
  const isBusy = (classes, timeMin) =>
    classes.some((c) => {
      const s = toMinutes(c.start);
      const e = toMinutes(c.end);
      return timeMin >= s && timeMin < e;
    });

  const commonFreeSlots = [];
  let inFreeBlock = false;
  let blockStart = 0;

  for (let min = 480; min <= 1080; min += 30) {
    const myBusy = isBusy(myDay, min);
    const friendBusy = isBusy(friendDay, min);
    const bothFree = !myBusy && !friendBusy;

    if (bothFree && !inFreeBlock) {
      inFreeBlock = true;
      blockStart = min;
    } else if (!bothFree && inFreeBlock) {
      inFreeBlock = false;
      const duration = min - blockStart;
      if (duration >= 50) {
        const formatClock = (m) => {
          const h = Math.floor(m / 60);
          const mins = m % 60;
          return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
        };
        commonFreeSlots.push({
          start: formatClock(blockStart),
          end: formatClock(min),
          durationMinutes: duration,
        });
      }
    }
  }
  if (inFreeBlock) {
    const duration = 1080 - blockStart;
    if (duration >= 50) {
      const formatClock = (m) => {
        const h = Math.floor(m / 60);
        const mins = m % 60;
        return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
      };
      commonFreeSlots.push({
        start: formatClock(blockStart),
        end: "18:00",
        durationMinutes: duration,
      });
    }
  }

  return {
    myDay,
    friendDay,
    sharedClasses,
    commonFreeSlots,
  };
}

export function getSavedFriends(accountKey = "") {
  try {
    if (typeof localStorage === "undefined") return [];
    const key = getStorageKey(accountKey);
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

export function saveFriend(friendData, accountKey = "") {
  try {
    const current = getSavedFriends(accountKey);
    const id = friendData.id || `friend_${Date.now()}`;
    const color =
      friendData.color ||
      FRIEND_COLORS[current.length % FRIEND_COLORS.length];

    const newFriend = {
      ...friendData,
      id,
      color,
      savedAt: new Date().toISOString(),
    };

    const updated = [
      newFriend,
      ...current.filter(
        (f) =>
          f.id !== id &&
          (friendData.regNo && f.regNo
            ? f.regNo.toLowerCase() !== friendData.regNo.toLowerCase()
            : (f.name || "").toLowerCase() !== (friendData.name || "").toLowerCase()),
      ),
    ];

    if (typeof localStorage !== "undefined") {
      localStorage.setItem(getStorageKey(accountKey), JSON.stringify(updated));
    }
    return updated;
  } catch (e) {
    return [];
  }
}

export function removeFriend(id, accountKey = "") {
  try {
    const current = getSavedFriends(accountKey);
    const updated = current.filter((f) => f.id !== id);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(getStorageKey(accountKey), JSON.stringify(updated));
    }
    return updated;
  } catch (e) {
    return [];
  }
}

export function updateFriendColor(id, color, accountKey = "") {
  try {
    const current = getSavedFriends(accountKey);
    const updated = current.map((f) => (f.id === id ? { ...f, color } : f));
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(getStorageKey(accountKey), JSON.stringify(updated));
    }
    return updated;
  } catch (e) {
    return [];
  }
}
