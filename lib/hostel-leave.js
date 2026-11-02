import { load } from "cheerio";
import { AppError } from "./errors.js";

const clean = (value) => value.replace(/\s+/g, " ").trim();
const heading = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function parseHostelLeave(html, kind) {
  const $ = load(html);
  const selector =
    kind === "status" ? "#LeaveAppliedTable" : "#LeaveHistoryTable";
  const table = $(selector);
  const empty =
    /no (?:leave )?(?:records?|applications?|data)(?:\s+(?:found|available))?/i;
  if (!table.length) {
    if (
      /not (?:a )?hosteller|only (?:for |to )?hostellers|day scholar/i.test(
        $("body").text(),
      )
    )
      throw new AppError(
        "HOSTEL_LEAVE_UNAVAILABLE",
        "Hostel leave details are only available for hostellers.",
        422,
      );
    if (
      /^no (?:leave )?(?:records?|applications?|data)(?:\s+(?:found|available))?[.!]?$/i.test(
        clean($("body").text()),
      )
    )
      return { available: true, items: [] };
    throw new AppError(
      "LEAVE_FORMAT_CHANGED",
      "VTOP did not return a recognised leave table. Please try again later.",
      502,
    );
  }
  const rows = table.find("tr").toArray();
  const headerRow = rows.find(
    (row) =>
      /(?:leave|application)(?:id|no|number)/.test(heading($(row).text())) &&
      /status/i.test($(row).text()),
  );
  const headers = headerRow
    ? $(headerRow)
        .find("th,td")
        .toArray()
        .map((cell) => heading($(cell).text()))
    : [];
  const aliases = {
    id: /^(?:leave|application)(?:id|no|number)$/,
    type: /^(?:leave)?type$/,
    from: /^(?:from|fromdate|leavingdate|fromdatetime)$/,
    to: /^(?:to|todate|returndate|todatetime)$/,
    status: /^(?:leave|application|approval)?status$/,
    appliedAt: /^(?:applieddate|appliedon|applicationdate)$/,
    place: /^(?:visitplace|placeofvisit|place|destination)$/,
    reason: /^(?:leave)?reason$/,
    remarks: /^(?:remarks?|comments?)$/,
  };
  const indexes = Object.fromEntries(
    Object.entries(aliases).map(([key, regex]) => [
      key,
      headers.findIndex((h) => regex.test(h)),
    ]),
  );
  const hasHeaders = headers.length > 0;
  if (
    hasHeaders &&
    ["id", "from", "to", "status"].some((key) => indexes[key] < 0)
  )
    throw new AppError(
      "LEAVE_FORMAT_CHANGED",
      "VTOP's leave columns could not be read. Your previous details are safe.",
      502,
    );
  // Positions are limited to the two table IDs used by the portal, as documented
  // in UniCC's Chennai hostel route; header matches take precedence.
  const fallback =
    kind === "status"
      ? {
          id: 2,
          place: 3,
          reason: 4,
          type: 5,
          from: 6,
          to: 7,
          status: 8,
          remarks: 9,
        }
      : {
          id: 1,
          place: 2,
          reason: 3,
          type: 4,
          from: 5,
          to: 6,
          status: 7,
          remarks: 8,
        };
  const items = [];
  for (const row of rows) {
    if (row === headerRow || $(row).find("th").length) continue;
    const cells = $(row).children("td").toArray();
    if (!cells.length || (cells.length === 1 && empty.test($(row).text())))
      continue;
    if (!hasHeaders && cells.length < (kind === "status" ? 9 : 8))
      throw new AppError(
        "LEAVE_FORMAT_CHANGED",
        "VTOP returned incomplete leave details.",
        502,
      );
    const read = (key) => {
      const index = hasHeaders ? indexes[key] : fallback[key];
      return index >= 0 && cells[index] ? clean($(cells[index]).text()) : "";
    };
    const item = Object.fromEntries(
      Object.keys(aliases).map((key) => [key, read(key)]),
    );
    if (!item.id || !item.status || !item.from || !item.to)
      throw new AppError(
        "LEAVE_FORMAT_CHANGED",
        "VTOP returned incomplete leave details.",
        502,
      );
    items.push(item);
  }
  return {
    available: true,
    items: [...new Map(items.map((item) => [item.id, item])).values()],
  };
}

export async function fetchHostelLeave(client) {
  await client.authenticated("hostels/student/leave/1", {
    verifyMenu: "true",
    nocache: String(Date.now()),
  });
  const read = async (kind) => {
    try {
      const html = await client.authenticated(
        `hostels/student/leave/${kind === "status" ? 4 : 6}`,
        {
          [kind]: "",
          form: "undefined",
          control: kind,
        },
      );
      return parseHostelLeave(html, kind);
    } catch (error) {
      if (error.code === "SESSION_EXPIRED") throw error;
      return {
        available: false,
        items: [],
        message:
          error instanceof AppError
            ? error.message
            : "Leave details could not be fetched. Try again later.",
      };
    }
  };
  // Sequential requests keep VTOP's cookie/CSRF session consistent.
  const status = await read("status");
  const history = await read("history");
  return { fetchedAt: new Date().toISOString(), status, history };
}
