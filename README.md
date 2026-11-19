# Vtopia (v1.2.0)

A modern, device-first VTOP companion for **VIT Chennai**, featuring an AMOLED Black & Velvet Noir theme engine, phone navigation, and client-side privacy. Built with React + Vite, Node.js Vercel Functions, Cheerio parsers, an IndexedDB academic cache, and optional encrypted on-device login storage. No server database required.

---

## What's New in v1.2.0

- 🏡 **Direct Hostel Leave Application**: Apply for hostel leave directly to the VTOP portal from within Vtopia. Includes all VTOP leave types (*Home Town*, *Outing*, *Emergency Leave*, *Local Guardian*, *Vacations*, *Official Leaves*), auto-populated Proctor banner, native calendar and clock pickers, quick reason presets (*Visiting home*, *Movie*, *College event*), and live *Leave Status* & *Leave History* tabs.
- 📊 **Attendance Matrix**: Interactive 6×6 projection grid (*Absent ↓ / Attend →*) for every course. Instantly see your exact percentage and attendance margin across future class scenarios, color-coded by safety tiers (*Safe*, *Borderline*, *At risk*) with tap-to-inspect breakdowns.
- ⏰ **Course Next 3 Classes Simulator**: Mini agenda inside individual course cards showing the next 3 upcoming classes based on real-time schedule, with one-tap Present/Absent simulation.
- 🎯 **Focused Overview Schedule**: Only the ongoing class (`Now`) is highlighted on the daily schedule; upcoming classes remain clean and distraction-free.
- 🎨 **Expanded Theme Engine**: 10 themes including AMOLED Pure Black, Velvet Noir, Neon Cyberpunk, Forest Night, Crimson Red-Black, Mocha Brown, and 4 clean light palettes.
- ⚡ **Enhanced Captcha Solver**: Upgraded sub-pixel offset alignment and multi-threshold contrast search for significantly higher first-attempt accuracy.
- 🛡️ **Privacy-First Admin Console**: Hidden, silent 10-tap unlock with PIN verification (`27112006`) to view active user telemetry without tracking passwords, campus, or private student data.
- 📲 **In-App APK Updater**: Automatic update detection in Settings that alerts installed Android app users when a new APK release is published on GitHub with one-tap updates.

---

## Run Locally

Requires Node.js 24 (the same major version configured for Vercel).

```powershell
npm install
npm run dev
```

Open [http://127.0.0.1:5184](http://127.0.0.1:5184). The custom dev server serves both the frontend and the backend API routes (`/api/captcha`, `/api/sync`, `/api/calendar`, `/api/overview`, `/api/hostel-leave`, `/api/admin`).

### Testing & Building

```powershell
npm test
npm run build
```

- `npm test`: Runs all 110 automated unit tests (attendance bounds, parsers, token auth, captcha solver, calendar day orders, hostel leave, and back-navigation).
- `npm run build`: Generates optimized production client bundles in `dist/`.

---

## Key Features

1. **Academic Overview & Timetable**:
   - Day-wise daily schedule with calendar day-order overrides and holiday suppression.
   - Highlights only the ongoing class in real time.
   - OD class hours totaled against the 40-hour limit.
   - Quick attendance status widgets and venue indicators.

2. **Attendance Tracker & Simulator**:
   - Complete course list against VIT's 75% rule.
   - Independent attend and miss projection sliders.
   - Multi-day range simulator with calendar picker.
   - Next 3 upcoming classes mini-simulator.
   - Interactive Attendance Matrix with scenario projections.

3. **Course Marks & Assessment Breakdown**:
   - Scores, weights, and max marks for CAT-1, CAT-2, DA, Quizzes, and FAT.
   - Unpublished marks stay distinct from earned zeroes.
   - Unread mark indicators that highlight newly published scores.

4. **Hostel Leave Management**:
   - Direct leave submission to VTOP.
   - Real-time leave status and complete history tracking.
   - Proctor information display.

5. **Security & Privacy**:
   - AES-256-GCM encrypted on-device credential vault using Web Crypto API.
   - Ephemeral session tokens sealed with server-side secrets.
   - Zero credential logging and no server-side academic storage.
   - Local on-device captcha reading via a 528-input/32-label classifier without third-party services.

6. **Native Android App (Capacitor)**:
   - Built-in Android widgets for today's classes and upcoming exams.
   - Native haptics, status bar styling, and back-button navigation stack.
   - In-app update checker linked to GitHub Releases.

---

## Vercel Deployment

1. Import this repository into Vercel with the **Vite** preset and **Node.js 24.x** runtime.
2. Generate a random session secret:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
3. Set `SESSION_SECRET` in Vercel project environment variables.
4. Deploy. `vercel.json` configures **Mumbai (`bom1`)** and a **120-second** function limit with Fluid Compute.
5. (Optional) Connect Upstash Redis or Vercel KV for persistent cross-container admin telemetry.

---

## Attribution & Disclaimer

- Inspired by VIT Chennai VTOP student workflows.
- Captcha neural weights adapted from [VTOP-Captcha-Solver](https://github.com/levyashvin/VTOP-Captcha-Solver) under MIT license.
- Independent open-source student project. Not affiliated with VIT.
