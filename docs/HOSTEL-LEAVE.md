# Hostel leave: read-only contract and manual verification

`POST /api/hostel-leave` accepts `{ "token": "<sealed Vtopia session>" }`.
It enforces same-origin requests, a per-instance rate limit, and an authenticated,
unexpired sealed token. It returns `{ leave: { fetchedAt, status, history }, token }`.
Each section has `available`, `items`, and an optional `message`. Records contain
`id`, `type`, `from`, `to`, `status`, and optional applied date/place/reason/remarks.
Empty published tables differ from unavailable/unrecognised pages. An expired
upstream session fails the request; an independent section failure preserves the
other section. Only the updated session is sealed; no server persistence is added.

The request flow is based on public Chennai integration code:
https://github.com/Arya4930/UniCC/blob/7d4eba6a76f27cface4eb993bb2ae9ff091beb9d/backend/src/routes/hostel.ts

1. Open `hostels/student/leave/1` with `verifyMenu=true`.
2. Read `hostels/student/leave/4` with `control=status`, `status=`, `form=undefined`.
3. Read `hostels/student/leave/6` with `control=history`, `history=`, `form=undefined`.

All include current CSRF/auth ID through VtopClient. No apply/submit/cancel routes
are implemented or called. UI fetch is an explicit user action, separate from Sync.
HTML parsers target `LeaveAppliedTable` and `LeaveHistoryTable`. Header mapping
takes precedence over the documented positional formats. Portal statuses and dates
are displayed verbatim; the app does not infer approval or permission to leave.

## Validation performed

Parser/security tests and local HTTP integration exercise both sections, current
CSRF propagation, sealed-token renewal, 503 history failure, and expired login.
These fixtures prove our flow, not current VTOP availability or real account data.

## Manual check

1. Sync the real account in Profile to establish a fresh in-memory session.
2. Open Profile → Hostel leave → Fetch from VTOP.
3. Compare Leave status and Leave history against the official portal.
4. Check leave IDs, dates/times, raw status and remarks. No leave is modified.
5. Reload and check that cached details remain. A new fetch after the five-minute
   session expires asks for another Profile sync. Clear device data removes cache.

## Original v1 feature audit

- Built: Sync/CAPTCHA and manual fallback, attendance/marks parsing, Dashboard,
  attendance calculator, weighted marks total, IndexedDB cache, PWA manifest and
  service worker, Mumbai Vercel configuration, error states, instance rate limit.
- Later additions built: bottom navigation/theme, academic calendar/reminders,
  daily timetable, OD/feedback, exams, semester switching, registered courses,
  saved login/settings, day/week attendance simulator, PDF faculty lookup.
- Optional FAT target-score estimator is not built.
- Live faculty cabin search is not built; official portal search returned empty
  results in the prior browser investigation. PDF lookup is dated and limited.
- Pending validation: live hostel leave output, phone install/offline behavior,
  deployed end-to-end Sync and VTOP's acceptance of Vercel egress IPs.
- Public deployment still needs deployment-wide rate limiting; the current
  in-memory limiter is best effort for a single function instance.
