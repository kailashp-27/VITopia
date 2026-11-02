# VTOP Chennai integration notes

Inspected 28 October 2026. Do not commit real login HTML, captcha/session tokens, cookies, credentials, or academic records.

## Observed directly (unauthenticated)

1. `GET https://vtopcc.vit.ac.in/vtop/login`: portal selector, cookie session, hidden `_csrf`.
2. `POST /vtop/prelogin/setup`: form fields `_csrf`, `flag=VTOP`. Returns the student login form.
3. Captcha is an embedded base64 PNG in `#captchaBlock img`. The form has `username`, `password`, `captchaStr`, and `_csrf`. `captchaStr` has maxlength 6. Username/captcha are uppercased by the official UI.
4. Login form submits directly to `POST /vtop/login` over HTTPS. No additional password-encryption step appeared in its inline scripts.
5. Official refresh path is `GET /vtop/get/new/captcha`. Vtopia instead starts a fresh isolated prelogin session when Refresh is clicked, avoiding races between old/new tokens.
6. VTOP omits the intermediate certificate from its TLS handshake. The current leaf's issuer is **Sectigo Public Server Authentication CA DV R36**. A scoped Node TLS bundle containing that public intermediate successfully completed the real captcha handshake.

## Corroborated by public wrapper source; requires authenticated validation

- Successful login includes hidden `#authorizedIDX`, used as `authorizedID` in later POSTs.
- Common authenticated fields: `authorizedID`, `_csrf`, `x` (UTC timestamp).
- Semester selector: `academics/common/StudentTimeTableChn`, then `#semesterSubId option`.
- Term enrollment probe: `processViewTimeTable`, `semesterSubId`.
- Attendance: menu `academics/common/StudentAttendance`, then `processViewStudentAttendance`, `semesterSubId`. Table headings identify code/title/type/attended/total.
- Marks: menu `examinations/StudentMarkView`, then `examinations/doStudentMarkView`, `semesterSubId`. `#fixedTableContainer` contains alternating course summary rows and nested component tables.

Automatic semester selection probes at most the first three listed terms for course rows. The Sync screen offers manual selection after a completed sync. Unexpected page structures fail explicitly and preserve the previous cached snapshot.

## Live verification record

- HTTPS and captcha handshake: passed from the local Node backend with full certificate validation.
- Username/password validity: pending a human-entered captcha and successful authenticated response.
- Authenticated attendance/marks parsers: pending live login; synthetic parser tests pass.
- Browser UI: desktop and 390-pixel viewport checked; search, lab filtering, marks, and the 22/30 → 24/32 attendance projection verified. No horizontal mobile overflow or browser console errors observed.
- Image verification: generic Tesseract OCR has been replaced by a VTOP-specific MIT-licensed 528-input/32-label classifier from levyashvin/VTOP-Captcha-Solver. Only numeric weights/biases were extracted; the third-party userscript was not executed. High-confidence results proceed within the user-triggered Sync action; uncertain images open a manual check. New automatic-flow live verification is pending action-time CAPTCHA confirmation.
- Credentials: the user authorized saving the login on this device. AES-GCM encryption/decryption, non-extractable keys, and tamper rejection pass automated tests. Saving via the app and restoring the saved-login card after a real browser reload were verified. No credentials were written to source files or server storage.
- Phone UI: Velvet Noir colors and the fixed bottom tab bar were inspected in the browser with existing cached academic data preserved.
- API boundaries: invalid token returned 401; unsupported methods returned 405; cross-origin request returned 403.
- Production PWA: build emits a versioned service worker precaching the exact hashed JavaScript/CSS assets. The in-app browser reported the worker ready, but a reload with the preview server stopped produced a blank page. Offline startup is **not confirmed**; repeat this check in an installed app or regular browser before relying on it.
- Vercel egress/IP compatibility: requires deployment verification.

These statuses must be updated from observed results, not inferred from a successful build.

## Academic calendar and UI update — 29 October 2026

- Added `/api/calendar` and independent parsers for VTOP's month tokens and calendar tables. Request paths/form fields were corroborated against the current public VtopMCP client/parser source. Calendar fetching is separate from the attendance/marks request, so an upstream calendar error does not discard an otherwise successful sync.
- Synthetic calendar fixtures cover deduplicated month tokens, instructional vs non-instructional days, repeated holiday labels, day-order overrides, leap-year dates, and markup failures. API guards reject unauthenticated/cross-origin/wrong-method requests. The live local route returned 401 for an invalid token before contacting VTOP.
- Calendar Month/Timeline navigation and personal-event save/reload/delete were checked in the actual browser. The temporary test event was removed. Profile attribution and absence of the old promotional sections were verified in the accessibility tree.
- Actual academic-calendar contents are still **not live-verified**: this preview has no active authenticated VTOP session. No CAPTCHA or login retry was attempted during this UI update. Old cached attendance/marks remain on their original browser origin.
- Local port 5174 was found serving a different project. The updated Vtopia preview runs on port 5184; browser storage is separate by origin. The other process and the old origin's storage were left untouched.

## Daily overview, combined calculator, and reminders — 29 October 2026

- Added an authenticated `/api/overview` read for the timetable, OD attendance details, and explicit feedback status when a supported same-origin page is available. Timetable grid/header and OD request fields were corroborated against [VtopMCP parsers](https://github.com/Vikranth-jagdish/VtopMCP/blob/main/src/services/vtop-parser.ts) and its [OD reader](https://github.com/Vikranth-jagdish/VtopMCP/blob/main/src/tools/od-calc.ts). Vtopia uses its own implementation. External feedback services are not followed; no feedback submission actions are called.
- Timetable and OD integrations are covered with synthetic grid/attendance fixtures, bounded-concurrency checks, and route authorization tests. Actual new overview fields are not live-verified; a fresh authenticated sync is still required. Existing cached academic records were preserved.
- In the actual phone viewport, the whole course opened its calculator, independent sliders at 5 attended + 2 missed produced 29/35 = 82.9%, and both maxima were 10. Marks rendered all courses with zero search inputs.
- The cached VTOP calendar showed 6 November as Holiday / no classes with its Deepavali label. This verifies cached rendering, not a new upstream fetch. New parser fixtures verify holiday labels outside parentheses override instructional tags. No fixed holiday dates were added to production logic.
- New calendar fixtures also cover explicit same-month holiday ranges, with conflict flags when a range contradicts an instructional tag. Reminders were checked in isolated demo mode: the date retained its holiday classification, gained a reminder indicator, and displayed an eight-day countdown. Demo reminders never write to the user's reminder database.


## Settings, marks, feedback, OD hours and exams — 30 October 2026

- Moved saved-login management, the official portal link, demo, clear-device-data action, install action, and attribution into Settings. Profile retains Sync, semester selection, exam schedule, and the semester course catalog. Settings and Profile share the same mounted sync controller so moving between them preserves in-memory input; account fields stay out of Profile.
- Replaced expanded marks cards with native details/summary controls. Total stays visible when collapsed, breakdown appears on expansion, and the old book icon/weighted-total wording is removed. Credits are read from the course catalog's final C value or an explicit credits column; missing credits are not inferred.
- Feedback now directly requests `processViewFeedBackStatus` with the selected semester, corroborated against [Deskly's feedback reader](https://github.com/Vishal-770/Deskly/blob/ec6463175d47d695cfed1f1ad5e36dc90fdee7ed/electron/services/other/FeedbackStatus.service.ts). The Curriculum/Course MID/TEE table supplied by the user is covered by Given/NOT Given fixtures, with semester mismatch checks.
- OD counts now distinguish entries from class hours. The parser uses timing spans so two-period lab attendance contributes two, accepts encoded attendance-detail identifiers, and retains totals above 40. A synthetic 43-hour case verifies that the result is not clipped or hardcoded. Actual account total of 43 is user-reported, not newly live-verified.
- Added the selected-semester `examinations/doSearchExamScheduleForStudent` read, retaining exam section, slot, date, time, venue, location, and seat fields. The source format was corroborated against [VtopMCP's exam parser](https://github.com/Vikranth-jagdish/VtopMCP/blob/main/src/services/vtop-parser.ts). Parser fixtures and sample Profile rendering verify these fields; a fresh authenticated sync remains required for live account validation.
- Browser checks verified ten real cached marks courses begin collapsed; expanding/collapsing the selected course reveals/hides assessments while keeping Total. Settings contains the account/device controls and attribution, Profile has no credential inputs, and its cached semester/course list remains intact. Sample data separately verifies credit labels and the exam card without replacing the real cache.

- Follow-up layout: Marks scores sit beside subject titles without a Total label or icon; tapping expanded content also collapses the card. Profile uses closed course/exam/semester list items, and Sync sends the selected semester. Blank Settings status space was removed. Identity reads only Name/Reg No from the student-profile response; live identity requires a fresh sync. Browser verified five semester options, no Load button, and whole-card toggle behavior.

- Profile navigation now opens separate Course list, Exam schedule, and Change semester screens with back navigation. The shared mounted sync controller preserves the pending semester choice. Course faculty names use the fetched catalog, falling back to cached timetable faculty fields. Cabin lookup is an explicitly external VTOP portal button with Faculty List instructions; automatic cabin scraping is not implemented. Browser verified faculty names on the real cached courses and all three page transitions.
