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

export function formatVtopDate(isoDateStr) {
  if (!isoDateStr) return "";
  if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(isoDateStr)) return isoDateStr;
  const parts = isoDateStr.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthIdx = parseInt(m, 10) - 1;
    const monthName = months[monthIdx] || m;
    return `${d.padStart(2, "0")}-${monthName}-${y}`;
  }
  return isoDateStr;
}

export function parseLeaveSubmitResponse(html) {
  const $ = load(html);
  const text = $("body").text();

  if ($("#vtopLoginForm").length || /session (?:has )?expired/i.test(text)) {
    throw new AppError(
      "SESSION_EXPIRED",
      "Your VTOP session expired. Sign in again.",
      401,
    );
  }

  const errorAlert = $(
    ".alert-danger, .alert-warning, .text-danger, font[color='red'], font[color='RED']",
  )
    .first()
    .text()
    .trim();
  if (errorAlert) {
    throw new AppError("LEAVE_APPLICATION_FAILED", clean(errorAlert), 422);
  }

  const errorMatch = text.match(
    /(?:leave already applied|cannot apply leave|not permitted|outing not allowed|exceeded limit|invalid (?:time|date|type)|contact warden|already applied for this date)/i,
  );
  if (errorMatch) {
    throw new AppError("LEAVE_APPLICATION_FAILED", clean(errorMatch[0]), 422);
  }

  const successAlert = $(".alert-success, .text-success").first().text().trim();
  const hasTable = $("#LeaveAppliedTable").length > 0;
  const successMatch = text.match(
    /(?:leave (?:request )?(?:submitted|applied|recorded) successfully|application submitted successfully|successfully submitted)/i,
  );

  if (hasTable || successAlert || successMatch) {
    const message =
      successAlert ||
      (successMatch
        ? clean(successMatch[0])
        : "Leave application submitted successfully.");
    return {
      success: true,
      message,
    };
  }

  if (/successfully/i.test(clean(text))) {
    return {
      success: true,
      message: "Leave application submitted successfully.",
    };
  }

  throw new AppError(
    "LEAVE_APPLICATION_FAILED",
    "VTOP did not confirm the leave application. Please check your Leave Status.",
    502,
  );
}

export async function applyHostelLeave(client, application) {
  if (!application) {
    throw new AppError(
      "INVALID_LEAVE_DETAILS",
      "Please provide all required leave details.",
      400,
    );
  }
  const {
    leaveType,
    visitingPlace,
    fromDate,
    fromTime,
    toDate,
    toTime,
    reason,
  } = application;

  if (!leaveType || leaveType === "-Select-") {
    throw new AppError(
      "INVALID_LEAVE_TYPE",
      "Please select a valid leave type.",
      400,
    );
  }
  if (!visitingPlace || !clean(visitingPlace)) {
    throw new AppError(
      "INVALID_LEAVE_PLACE",
      "Please specify the visiting place.",
      400,
    );
  }
  if (!fromDate || !fromTime || !toDate || !toTime) {
    throw new AppError(
      "INVALID_LEAVE_DATES",
      "Please provide both departure and return dates and times.",
      400,
    );
  }

  await client.authenticated("hostels/student/leave/1", {
    verifyMenu: "true",
    nocache: String(Date.now()),
  });

  const formattedFrom = formatVtopDate(fromDate);
  const formattedTo = formatVtopDate(toDate);

  const payload = {
    leaveType: clean(leaveType),
    visitingPlace: clean(visitingPlace),
    fromDate: formattedFrom,
    fromTime: clean(fromTime),
    toDate: formattedTo,
    toTime: clean(toTime),
    reason: clean(reason || visitingPlace),
    control: "apply",
    form: "undefined",
  };

  const html = await client.authenticated("hostels/student/leave/2", payload);
  return parseLeaveSubmitResponse(html);
}
