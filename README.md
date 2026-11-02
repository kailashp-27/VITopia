# Vtopia

A minimal, device-first VTOP companion for **VIT Chennai**, with a Velvet Noir theme and phone navigation at the bottom. React + Vite frontend, Node.js Vercel Functions, Cheerio parsers, an IndexedDB academic cache, and optional encrypted login storage on the device. No server database.

## Run locally

Requires Node.js 24 (the same major version configured for Vercel).

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5184. The custom dev server serves both the frontend and the real API routes. It creates a random session key **in memory** if `.env.local` is absent. Restarting invalidates existing captcha tokens. Set `PORT` to change the port. The former port 5174 is currently used by another project; its browser storage was left untouched. Browser caches and saved logins are separate for each port.

Choose **Explore demo** for fictional sample data; demo data is never cached as real data. To connect, go to **Sync**, enter your credentials, and tap **Sync now**. Select **Remember login on this device** and **Save login on this device** to make future syncs one tap. **Manage** lets you edit the saved login; **Forget saved login** removes it. **Clear all device data** removes both academic data and saved credentials. The server never persists credentials.

The sync button fetches a fresh image captcha and runs a small **VTOP-specific classifier** locally. The 528-input/32-label model comes from the MIT-licensed [VTOP-Captcha-Solver](https://github.com/levyashvin/VTOP-Captcha-Solver); its license and source attribution are retained in `src/vendor/`. Only confident predictions are submitted automatically. Uncertain predictions or unsupported images open an editable verification step. There are no automatic login retries. Google reCAPTCHA requires the official portal. No captcha-solving API or third-party image upload is used. The earlier generic Tesseract reader and its large assets have been removed.

Saved credentials use AES-256-GCM with a non-extractable Web Crypto key and random IV, stored in a separate IndexedDB vault. The key is stored with the ciphertext so this origin can unlock it without a separate PIN. This is convenience storage for a trusted browser profile, not protection against malicious scripts running on the same origin or someone using the unlocked profile. No plaintext password is written to localStorage, source files, or server storage.

```powershell
npm test
npm run build
```

`npm run preview` previews only the static production build; use `npm run dev` or a Vercel deployment for live sync. Service workers register only in production, so Vite's development scripts are not cached.

## Vercel deployment

1. Import this project into Vercel with the Vite framework preset and Node.js 24 runtime.
2. Generate a server secret:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
3. Set `SESSION_SECRET` in Vercel's environment settings for the intended environments. Never use a `VITE_` prefix, commit the value, or add the VTOP password to environment files. All function instances must use the same secret.
4. Deploy. `vercel.json` selects **Mumbai (`bom1`)** and a **120-second** function limit. Enable Fluid Compute. The sketch's old 10-second assumption does not apply with current Fluid Compute defaults: [Vercel function duration docs](https://vercel.com/docs/functions/configuring-functions/duration).
5. Before inviting others to a public URL, configure Vercel Firewall rate limits for `/api/captcha` and `/api/sync`. The code has a bounded per-instance request limiter (12 captcha / 6 sync requests per five minutes), which is **best effort**, not a distributed abuse limit.
6. Run one real login on the deployment. A local success does not prove VTOP accepts Vercel's outbound IPs. If it serves Google reCAPTCHA, Vtopia reports that condition and links to official VTOP; it does not bypass the challenge.

The public Sectigo R36 intermediate certificate in `lib/certificates/` completes VTOP's incomplete TLS chain. Certificate and hostname validation stay enabled. Vercel's dependency tracing must include that PEM file (it is referenced through `new URL(..., import.meta.url)` in the function dependency graph).

## What's built

- Empty-first overview, clearly labelled demo, weighted overall attendance, daily timetable with weekday/date tabs and calendar day-order overrides, OD class-hour totals against 40, compact feedback status, and sync timestamps. Missing upstream details display "Not available".
- Attendance shows the complete course list against the 75% rule. Tap anywhere on a course to open a calculator with independent 0–10 attend and miss sliders; both changes combine in one projection. The saved attendance stays unchanged.
- Collapsed-by-default course marks with a visible score, native expand/collapse controls, and fetched course credits. Expanded cards show the assessment breakdown. Unpublished marks are `null`, distinct from an earned zero. Weights that VTOP does not supply are excluded, with a notice.
- Real captcha and login routes, streamed sync progress, automatic selection among the three latest terms, and manual semester selection after sign-in.
- Image captcha fallback: choose manual entry upfront, or enter a fresh image after an uncertain reader result or a rejected answer. A rejected answer never causes an automatic login retry. Google reCAPTCHA is reported separately; this challenge cannot be replaced with typed image characters, and signing into official VTOP does not transfer that browser session to Vtopia.
- AES-256-GCM session tokens, five-minute expiry, input validation, same-origin checks, sanitized errors, no credential logging, no academic data stored on the server.
- Browser-side cache, clear-device-data action, manifest, app icons, and an app-shell service worker that excludes all API traffic.
- Compact page-title headers replace the logo/campus strip and promotional headings. Five icon tabs: Home, Attendance, Calendar, Marks, Profile. Profile contains Sync, semester selection, the exam schedule, and registered courses. Account management, saved-login/device controls, demo, portal link, installation, and **by Kailash** live in Settings.
- Calendar with a month grid, working-day underlines, holiday colors, VTOP day-order data, and separate reminder bells/countdowns. Reminders are stored locally without changing the academic calendar or attendance. Demo reminders stay in memory. Explicit holiday/vacation labels override generic instructional flags; unclassified dates stay unknown. Academic data is fetched after successful sync or by Calendar refresh while the session is valid.
- Velvet Noir palette (`#8B5CF6`, `#130F1A` background, `#1C1524` panels, `#EDE9FE`, `#A78BFA`), bottom tabs with safe-area spacing, keyboard navigation, reduced-motion support, and labelled controls.

## Data and session flow

```text
Browser → GET /api/captcha → VTOP login → student selection
       ← captcha image + encrypted five-minute session token

Browser → POST /api/sync (credentials + captcha + token)
        → VTOP login → semester discovery → attendance → marks
       ← newline-delimited progress events, then JSON snapshot
        → IndexedDB academic cache + optional encrypted device login vault
```

Session tokens remain in page memory. Their encrypted payload contains VTOP cookies and CSRF, plus `authorizedID` only after successful login. Passwords are not sealed into session tokens. Every request constructs its own cookie jar. The authenticated token permits a semester change for up to five minutes. Future syncs can read the optionally saved device login and establish a fresh VTOP session.

## Verification scope

Automated tests cover calculator boundaries over thousands of inputs, weighted marks, token expiry/tampering, reordered attendance columns, nested marks, missing marks, and semester dropdowns. Parser fixtures are synthetic examples based on observed/public VTOP structures; they do not replace checking an authenticated live response. Desktop/mobile UI and API request rejection were checked. The in-app browser reported the production worker ready but showed a blank page on a server-offline reload; offline startup still needs validation in a regular browser or installed PWA. See `docs/RECON.md` for observed fields and `docs/API.md` for route contracts.

Overview fetching is separate from attendance/marks, so its failure preserves the successful core sync. Timetable, course credits, OD detail, feedback-status, and exam request formats were corroborated against public Chennai wrapper source and tested with synthetic responses. New values require a fresh authenticated sync. Feedback posts the selected `semesterSubId` to `processViewFeedBackStatus` and reads Curriculum/Course MID and TEE Given/NOT Given cells. OD totals use recorded timing spans (roughly 50 minutes per class period, so a two-period lab counts as two); missing OD timings make the total unavailable. Totals are displayed against 40 without clipping. No account's OD count or feedback result is hardcoded.

The app does not yet fetch grades/CGPA or background push notifications. Reminders are date-based entries shown inside the app. A FAT estimator is deferred because assessment weights and pass rules vary by course; v1 displays the weights VTOP actually supplies.

## References

- [Official VTOP Chennai](https://vtopcc.vit.ac.in/vtop/login), inspected directly.
- [VtopMCP](https://github.com/Vikranth-jagdish/VtopMCP) and [android-vtop-chennai](https://github.com/therealsujitk/android-vtop-chennai), consulted to corroborate VTOP endpoint names and nested table layouts. This project uses its own implementation and does not depend on either wrapper.

Independent student project. Not affiliated with VIT.

## New marks indicator

After a successful sync, Vtopia compares published scores against the previous
snapshot for the same semester. New assessments, newly published scores (including
zero), and score corrections add a small dot to the Marks navigation icon. Opening
Marks clears the unread indicator and shows dots beside the affected courses for
that visit. The first sync establishes a baseline. This check runs during Sync;
it is not background polling or an operating-system push notification.

Profile also includes Attendance Simulator and read-only Hostel leave status/history.
See `docs/HOSTEL-LEAVE.md` for the leave contract and manual verification steps.
