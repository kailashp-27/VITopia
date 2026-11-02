# Vtopia API v1

All routes are same-origin only and set `Cache-Control: no-store, private`. Errors never return upstream HTML, request payloads, credentials, or raw exceptions. Request JSON is limited to 20 KB.

## GET /api/captcha

Success 200: `{ image: "data:image/png;base64,...", token: "<AES-GCM sealed session>", expiresAt: <unix milliseconds> }`.

Creates a VTOP prelogin session. Token expires in five minutes; do not persist it. Requesting a new captcha starts a new session. No credentials are sent by this route.

If VTOP returns Google reCAPTCHA instead of an image, the route returns `GOOGLE_VERIFICATION_REQUIRED` (503). Missing/unsupported image markup returns `CAPTCHA_UNSUPPORTED` (503). The browser preserves these codes. Manual mode only handles image captchas. After an `INVALID_CAPTCHA` sync error it obtains one fresh image and waits for the user to enter and submit the answer; it never automatically retries the login.

## POST /api/sync

`Content-Type: application/json`.

Initial sync body: `{ token, username, password, captcha }`.

Semester change body: `{ token: <authenticated token>, semesterId: <ID from returned semesters> }`.

Success stream uses `application/x-ndjson` (one JSON object per newline):

```json
{"type":"progress","stage":"login","message":"Logging in securely"}
{"type":"progress","stage":"semester","message":"Finding your semester"}
{"type":"progress","stage":"attendance","message":"Fetching attendance"}
{"type":"progress","stage":"marks","message":"Fetching marks"}
{"type":"result","data":{"syncedAt":"ISO timestamp","semester":{"id":"...","name":"..."},"semesters":[],"attendance":[],"marks":[]},"token":"<authenticated session token>"}
```

Attendance: `{ code, title, type, slot, attended, total, percent }`; `percent=null` when total is zero. Percentage is recomputed from counts.

Marks: `{ code, title, type, components: [{ name, scored, max, weight, weighted, status }] }`. Missing numeric cells are `null`, not zero. `weight` is maximum percentage weight; `weighted` is the weighted score reported by VTOP when available.

Before streaming, errors use the appropriate HTTP status and `{ code, message }`. Once streaming starts, upstream errors use `{ type: "error", code, message }` at HTTP 200. Clients must inspect stream events and require a final `result` before replacing cached data.

Error codes: `SESSION_EXPIRED` (401), `INVALID_INPUT`/`INVALID_BODY` (400/413/415), `INVALID_CAPTCHA`/`INVALID_CREDENTIALS`/`LOGIN_FAILED` (401), `ACCOUNT_LOCKED` (403), `INVALID_SEMESTER` (400), `NO_SEMESTER` (422), `RATE_LIMITED` (429), `CAPTCHA_UNSUPPORTED`/`GOOGLE_VERIFICATION_REQUIRED`/`CONFIGURATION` (503), `PARSE_ERROR`/`VTOP_UNAVAILABLE`/`UPSTREAM_REDIRECT` (502), `FORBIDDEN` (403), `METHOD_NOT_ALLOWED` (405).

No route saves credentials, tokens, or academic records. A per-instance in-memory rate limiter stores only SHA-256 request-bucket identifiers, counters, and expiry times; use platform-wide firewall limits for public hosting.

## POST /api/calendar

Body: `{ token: <authenticated five-minute session token>, semesterId }`. Requires an authenticated token; a captcha/prelogin token is insufficient. The semester must appear in the current account's VTOP semester list.

Success: `{ calendar: { source: "VTOP academic calendar", semesterId, fetchedAt: <ISO timestamp>, months: ["2026-10"], days: [{ date: "2026-10-29", instructional: true, label: "...", dayOrder: "Monday" | null }] } }`.

The route loads `academics/common/CalendarPreview`, gets month tokens from `getListForSemester`, and requests `processViewCalendar` for each token. At most twelve months are accepted, fetched two at a time. Invalid page structures return `CALENDAR_UNAVAILABLE` (502); missing/expired authentication returns `SESSION_EXPIRED` (401). Responses remain private and uncached by HTTP.

After `/api/sync` succeeds, the Profile screen requests this route separately. Attendance/marks remain saved if calendar fetching fails. Successful calendar data is merged into the same-semester IndexedDB snapshot. Refresh on Calendar reuses the authenticated token while it remains valid. Personal events are stored separately on the device and are never submitted to VTOP.

Calendar `instructional` is `true`, `false`, or `null` for an unclassified entry. All day labels are retained, including text outside parentheses. Explicit holiday/vacation wording wins over a generic instructional flag; conflicts are flagged and shown in the selected-day details. Explicit same-month ranges such as "4 to 11 November 2026" apply to the fetched dated entries in that range. Ambiguous/cross-month prose remains a label. No holiday dates are hardcoded.

## POST /api/overview

Body: `{ token: <authenticated session token>, semesterId }`. The same method, origin, input, rate-limit, and account-semester membership checks apply. A prelogin token is rejected before contacting VTOP.

Success: `{ overview: { semesterId, fetchedAt, timetable, courses, exams, ods, feedback }, token: <updated sealed session> }`.

- `timetable`: `{ available: true, classes: [{ day: "MON", code, title, type, slot, venue, faculty, start: "08:00", end: "08:50" }] }`. Times come from the actual weekly grid, including row/column spans; consecutive lab periods are combined. A course list without a recognized weekly grid is unavailable.
- `courses`: registered course catalog from `processViewTimeTable`, including code, title, type, nullable credits, slot, venue, and faculty. Credits come from the final C column in L/T/P/J/C, or an explicit credit column; none are inferred from course codes.
- `exams`: `{ available: true, items: [{ examType, date, time, slot, code, title, venue, location, seat }] }` from `examinations/doSearchExamScheduleForStudent`, with the selected `semesterSubId`. A recognized unpublished/empty response is distinct from an unrecognized page.
- `ods`: `{ available: true, entries, hours, limit: 40, coursesChecked, unit: "class hours" }`. Reads attendance detail handles, including encoded identifiers, two at a time. OD statuses count only from attendance records; class-hour totals use explicit periods/hours or timing spans divided into approximately 50-minute periods. Missing OD timing information makes the total unavailable. No clipping at 40. `entries` remains a separate row count.
- `feedback`: selected-semester response from `processViewFeedBackStatus`. Returns `{ available, semesterId, status, rows: [{ type: "Curriculum" | "Course", mid: "given" | "not-given" | "unknown", tee: ... }], submitted, total }`. NOT Given is checked before Given. A fragment without a semester selector is accepted only after an explicit server-side request for the validated semester. A mismatching selected semester is rejected. No feedback is filled or submitted.
- Any optional section may instead return `{ available: false, message? }`. Session expiry remains an error. Optional reads use a time budget and never replace attendance or marks.

After core sync, Profile fetches overview details, stores them in the same-semester snapshot, adopts the updated sealed token, then fetches the academic calendar. Each stage has a separate timeout. User reminders remain separate and do not enter timetable-day or attendance calculations.
