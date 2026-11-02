import { load } from "cheerio";
import { AppError } from "./errors.js";
const clean = (value) => value.replace(/\s+/g, " ").trim();
const number = (value) =>
  /^\s*-?\d+(\.\d+)?\s*%?\s*$/.test(value) ? parseFloat(value) : null;
const textCells = ($, row) =>
  $(row)
    .children("td, th")
    .map((_, cell) => clean($(cell).text()))
    .get();
const directRows = (table) =>
  table.children("tr").add(table.children("tbody, thead").children("tr"));
function layout($, table, predicates) {
  const rows = directRows(table).toArray();
  for (let i = 0; i < rows.length; i++) {
    const headers = textCells($, rows[i]).map((s) => s.toLowerCase());
    const indexes = Object.fromEntries(
      Object.entries(predicates).map(([key, match]) => [
        key,
        headers.findIndex(match),
      ]),
    );
    if (indexes.code >= 0 || indexes.name >= 0)
      return { rows: rows.slice(i + 1), indexes };
  }
  return null;
}
export function csrfFrom(html) {
  const $ = load(html);
  return (
    $('input[name="_csrf"]').attr("value") ||
    $('meta[name="_csrf"]').attr("content")
  );
}
export function authFrom(html) {
  return load(html)("#authorizedIDX").attr("value");
}
export function parseSemesters(html) {
  const $ = load(html);
  return $("#semesterSubId option")
    .map((_, el) => ({
      id: $(el).attr("value")?.trim(),
      name: clean($(el).text()),
    }))
    .get()
    .filter((s) => s.id && s.id !== "0");
}
export function parseAttendance(html) {
  const $ = load(html);
  const records = [];
  let recognized = false;
  $("table").each((_, el) => {
    const info = layout($, $(el), {
      code: (h) => h.includes("code"),
      title: (h) => /title|course name/.test(h),
      type: (h) => h.includes("course type"),
      attended: (h) => h.includes("attended"),
      total: (h) => h.includes("total"),
      slot: (h) => h.includes("slot"),
    });
    if (!info || info.indexes.attended < 0 || info.indexes.total < 0) return;
    recognized = true;
    for (const row of info.rows) {
      const cells = textCells($, row),
        get = (key) => cells[info.indexes[key]] || "";
      const attended = number(get("attended")),
        total = number(get("total"));
      if (!get("code") || !/[A-Z]{2,}\d{3,4}/.test(get("code"))) continue;
      if (attended === null || total === null)
        throw new AppError(
          "PARSE_ERROR",
          "VTOP returned missing attendance counts. Your previous data is safe.",
          502,
        );
      if (
        attended < 0 ||
        total < attended ||
        !Number.isInteger(total) ||
        !Number.isInteger(attended)
      )
        throw new AppError(
          "PARSE_ERROR",
          "VTOP returned attendance in an unexpected format.",
          502,
        );
      records.push({
        code: get("code"),
        title: get("title"),
        type: get("type"),
        slot: get("slot"),
        attended,
        total,
        percent: total ? Math.round((attended / total) * 1000) / 10 : null,
      });
    }
  });
  if (
    !records.length &&
    !recognized &&
    !/no (data|records)|not found|no attendance/i.test($.root().text())
  )
    throw new AppError(
      "PARSE_ERROR",
      "The VTOP attendance page changed. Your previous data is safe.",
      502,
    );
  return records;
}
export function parseMarks(html) {
  const $ = load(html);
  const records = [];
  const container = $("#fixedTableContainer");
  const table = container.is("table")
    ? container
    : container.find("table").first();
  const info = layout($, table, {
    code: (h) => h.includes("course") && h.includes("code"),
    title: (h) => /title|course name/.test(h),
    type: (h) => h.includes("course type"),
    credits: (h) => h === "credits" || h === "credit",
  });
  if (!info) {
    if (/no (data|records)|not found|no marks/i.test($.root().text()))
      return [];
    throw new AppError(
      "PARSE_ERROR",
      "The VTOP marks page changed. Your previous data is safe.",
      502,
    );
  }
  for (let i = 0; i < info.rows.length; i++) {
    const row = $(info.rows[i]);
    if (row.find("table").length) continue;
    const cells = textCells($, row);
    const code = cells[info.indexes.code];
    if (!code || !/[A-Z]{2,}\d{3,4}/.test(code)) continue;
    const inner = $(info.rows[i + 1])
      .find("table")
      .first();
    const components = [];
    const componentLayout = layout($, inner, {
      name: (h) => /title|component/.test(h),
      max: (h) => h.includes("max") && !/weight|%/.test(h),
      scored: (h) => h.includes("scored"),
      weight: (h) => /%|max.*weight/.test(h),
      weighted: (h) =>
        /weight/.test(h) && h.includes("mark") && !/max|%/.test(h),
      status: (h) => h.includes("status"),
    });
    if (inner.length && !componentLayout)
      throw new AppError(
        "PARSE_ERROR",
        "VTOP returned an unrecognized marks table.",
        502,
      );
    if (componentLayout)
      for (const componentRow of componentLayout.rows) {
        const c = textCells($, componentRow),
          get = (key) => c[componentLayout.indexes[key]] || "";
        if (!get("name") || /total/i.test(get("name"))) continue;
        components.push({
          name: get("name"),
          scored: number(get("scored")),
          max: number(get("max")),
          weight: number(get("weight")),
          weighted: number(get("weighted")),
          status: get("status"),
        });
      }
    records.push({
      code,
      title: cells[info.indexes.title] || "",
      type: cells[info.indexes.type] || "",
      components,
      ...(info.indexes.credits >= 0
        ? { credits: number(cells[info.indexes.credits] || "") }
        : {}),
    });
  }
  return records;
}
