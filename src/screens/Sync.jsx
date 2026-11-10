import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useVtopSync } from "../hooks/useVtopSync.js";
import { useBackOverlay } from "../hooks/useBackOverlay.js";
import { demo } from "../demo.js";

export default function Sync({
  online,
  onData,
  data,
  demoMode = false,
  onDemo,
  onClear,
  onSession,
  onCalendar,
  onOverview,
  settings = false,
  page = "profile",
  onNavigate,
  onSettings,
  sessionToken,
}) {
  const [semesterModalOpen, setSemesterModalOpen] = useState(false);
  useBackOverlay(
    Boolean(semesterModalOpen && data?.semesters?.length),
    () => setSemesterModalOpen(false),
  );
  const {
    username,
    setUsername,
    password,
    setPassword,
    saved,
    ready,
    remember,
    setRemember,
    visible,
    setVisible,
    editing,
    setEditing,
    busy,
    saving,
    error,
    errorCode,
    progress,
    challenge,
    captcha,
    setCaptcha,
    expired,
    semesterId,
    setSemesterId,
    storeLogin,
    forgetLogin,
    loadManualCaptcha,
    runSync,
  } = useVtopSync({
    online,
    data,
    sessionToken,
    onData,
    onSession,
    onCalendar,
    onOverview,
    onMissingCredentials: onSettings,
  });
  return (
    <div
      hidden={
        page === "courses" ||
        page === "exams" ||
        page === "simulator" ||
        page === "hostel-leave" ||
        page === "widget-customization" ||
        page === "theme-customization" ||
        page === "details" ||
        page === "proctor" ||
        page === "cgpa-calculator"
      }
      className={settings ? "sync-layout account-settings" : "sync-layout"}
    >
      <section className="sync-card">
        <div>
          {settings ? (
            <h2 className="profile-section-title">VTOP account</h2>
          ) : null}
          {!settings ? (
            <div
              className="profile-identity"
              onClick={() => onNavigate("details")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onNavigate("details");
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <div className="profile-identity-info">
                <h2>
                  {data?.overview?.profile?.name ||
                    (demoMode ? demo.overview?.profile?.name : null) ||
                    "Your profile"}
                </h2>
                <p>
                  {data?.overview?.profile?.registration ||
                    (demoMode ? demo.overview?.profile?.registration : null) ||
                    (username
                      ? `Login: ${username}`
                      : "Name and register number appear after sync")}
                </p>
              </div>
              <button
                type="button"
                className="profile-details-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate("details");
                }}
                aria-label="View student details"
              >
                <span>Student details</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ) : null}

          <form onSubmit={settings ? (e) => e.preventDefault() : runSync}>
            {settings ? (
              saved && !editing ? (
                <div className="saved-login">
                  <span className="saved-login-icon">
                    <LockKeyhole size={18} />
                  </span>
                  <div>
                    <strong>{username}</strong>
                    <span>Login saved on this device</span>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setEditing(true)}
                    disabled={busy}
                  >
                    Manage
                  </button>
                </div>
              ) : (
                <div className="login-fields">
                  <label>
                    VTOP username
                    <input
                      autoComplete="username"
                      name="username"
                      placeholder="Your VTOP login ID"
                      value={username}
                      onChange={(e) =>
                        setUsername(e.target.value.toUpperCase())
                      }
                      required
                      disabled={busy || !ready}
                    />
                  </label>
                  <label>
                    Password
                    <div className="password-field">
                      <input
                        type={visible ? "text" : "password"}
                        autoComplete="current-password"
                        name="password"
                        placeholder="Your VTOP password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={busy || !ready}
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={visible ? "Hide password" : "Show password"}
                        onClick={() => setVisible((v) => !v)}
                      >
                        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>
                  <label className="remember-login">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <span>
                      Remember login on this device
                      <small>
                        Encrypted locally. Use a phone or browser profile you
                        trust.
                      </small>
                    </span>
                  </label>
                  {remember ? (
                    <button
                      type="button"
                      className="button secondary full-width"
                      onClick={storeLogin}
                      disabled={!username || !password || saving || busy}
                    >
                      {saving ? (
                        <LoaderCircle className="spinning" size={14} />
                      ) : (
                        <LockKeyhole size={14} />
                      )}
                      Save login on this device
                    </button>
                  ) : null}
                </div>
              )
            ) : null}
            {!settings && challenge && !busy ? (
              <div className="verification-panel">
                <div className="captcha-label">
                  <span>Verify to continue</span>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={loadManualCaptcha}
                  >
                    <RefreshCw size={13} /> New image
                  </button>
                </div>
                <div className="captcha-box">
                  <img
                    src={challenge.image}
                    alt="VTOP verification image. Check the six characters below."
                  />
                  <span className={expired ? "warning" : ""}>
                    {expired
                      ? "Expired — get a new image"
                      : "Enter the six characters shown"}
                  </span>
                </div>
                <label>
                  <span className="sr-only">Captcha text</span>
                  <input
                    name="captcha"
                    placeholder="Enter the 6 characters"
                    value={captcha}
                    onChange={(e) => setCaptcha(e.target.value.toUpperCase())}
                    maxLength={6}
                    minLength={6}
                    required
                    autoFocus
                    disabled={busy || expired}
                    autoComplete="off"
                  />
                </label>
              </div>
            ) : null}
            {error ? (
              <div className="form-message error" role="alert">
                {error}
                {errorCode === "GOOGLE_VERIFICATION_REQUIRED" ? (
                  <a
                    className="verification-link"
                    href="https://vtopcc.vit.ac.in/vtop/login"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open official VTOP <ArrowUpRight size={14} />
                  </a>
                ) : null}
              </div>
            ) : null}
            {!settings ? (
              <button
                className="button primary full-width sync-primary"
                type="submit"
                disabled={busy || !online || !ready}
                formNoValidate={!!expired}
              >
                {busy ? (
                  <>
                    <LoaderCircle className="spinning" size={17} /> Please wait…
                  </>
                ) : (
                  <>
                    <RefreshCw size={17} />
                    {expired
                      ? "Get new captcha"
                      : challenge
                        ? "Verify and sync"
                        : "Sync now"}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            ) : null}
            {!settings && !challenge && error ? (
              <button
                className="text-button manual-captcha"
                type="button"
                onClick={loadManualCaptcha}
                disabled={busy || !online || !ready}
              >
                Enter captcha manually
              </button>
            ) : null}
            {!settings || progress ? (
              <div className="sync-progress" role="status" aria-live="polite">
                {progress || "Ready to sync."}
              </div>
            ) : null}
          </form>
          {settings && saved ? (
            <button
              type="button"
              className="text-button forget-login"
              onClick={forgetLogin}
              disabled={busy}
            >
              <Trash2 size={13} /> Forget saved login
            </button>
          ) : null}
        </div>
        {!settings && data?.semesters?.length ? (
          <button
            type="button"
            className="profile-page-link"
            onClick={() => setSemesterModalOpen(true)}
          >
            Change semester <span aria-hidden="true">›</span>
          </button>
        ) : null}
        {semesterModalOpen && data?.semesters?.length ? (
          <div
            className="semester-modal-portal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="semester-modal-title"
          >
            <div
              className="semester-modal-backdrop"
              onClick={() => setSemesterModalOpen(false)}
              aria-hidden="true"
            />
            <div className="semester-modal-box">
              <div className="semester-modal-header">
                <h2 id="semester-modal-title">Change semester</h2>
                <button
                  type="button"
                  className="icon-button modal-close-btn"
                  onClick={() => setSemesterModalOpen(false)}
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="semester-modal-body">
                <label className="semester-select-label">
                  <span>Select semester</span>
                  <select
                    className="semester-dropdown"
                    value={semesterId}
                    onChange={(e) => setSemesterId(e.target.value)}
                    disabled={busy}
                  >
                    {data.semesters.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="footnote">
                  Active: {data?.semester?.name || "None"}
                </p>
              </div>
              <div className="semester-modal-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setSemesterModalOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button primary"
                  onClick={async (e) => {
                    setSemesterModalOpen(false);
                    await runSync(e);
                  }}
                  disabled={busy || !online}
                >
                  Switch & Sync
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {settings ? (
          <div className="profile-actions">
            <a
              href="https://vtopcc.vit.ac.in/vtop/login"
              target="_blank"
              rel="noreferrer"
            >
              Open VTOP <ArrowUpRight size={14} />
            </a>
            <button className="text-button" type="button" onClick={onDemo}>
              View demo
            </button>
            {data ? (
              <button
                className="text-button danger"
                type="button"
                onClick={onClear}
              >
                <Trash2 size={13} />
                Clear device data
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
