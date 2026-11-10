import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Download,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Palette,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { useVtopSync } from "../hooks/useVtopSync.js";
import { THEMES, applyTheme, getSavedThemeId } from "../theme.js";

export default function Login({
  online,
  notice = "",
  onDismissNotice,
  onData,
  onSession,
  onCalendar,
  onOverview,
  onStart,
  onFinish,
  onDemo,
  installPrompt,
  onInstallApp,
  isStandalone = false,
  isIosInstallable = false,
}) {
  const [themeId, setThemeId] = useState(getSavedThemeId);
  const [themeOpen, setThemeOpen] = useState(false);
  const themeMenuRef = useRef(null);

  const sync = useVtopSync({
    online,
    data: null,
    sessionToken: null,
    defaultRemember: true,
    onData,
    onSession,
    onCalendar,
    onOverview,
    onStart,
    onFinish,
  });

  useEffect(() => {
    if (!themeOpen) return undefined;
    const handleOutside = (e) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [themeOpen]);

  const activeTheme =
    THEMES.find((t) => t.id === themeId) || THEMES[4] || THEMES[0];

  const handleSelectTheme = (id) => {
    const applied = applyTheme(id);
    setThemeId(applied.id);
    setThemeOpen(false);
  };

  return (
    <div className="login-shell compact-app">
      <header className="login-topbar">
        <div className="login-brand">
          <span className="brand-symbol login-brand-mark" aria-hidden="true">
            V
          </span>
          <div className="login-brand-copy">
            <strong>Vtopia</strong>
            <span>VIT Chennai</span>
          </div>
        </div>

        <div className="login-topbar-actions" ref={themeMenuRef}>
          {!online ? (
            <span className="offline-tag login-offline-tag" role="status">
              <WifiOff size={14} />
              <span>Offline</span>
            </span>
          ) : null}
          <button
            type="button"
            className="login-theme-btn"
            aria-label="Choose appearance theme"
            aria-expanded={themeOpen}
            onClick={() => setThemeOpen((prev) => !prev)}
          >
            <span
              className="login-theme-swatch"
              style={{ background: activeTheme.accent }}
              aria-hidden="true"
            />
            <Palette size={15} />
            <span className="login-theme-label">{activeTheme.name}</span>
          </button>

          {themeOpen ? (
            <div className="login-theme-popover" role="menu">
              {THEMES.map((t) => {
                const selected = t.id === activeTheme.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className={`login-theme-option ${selected ? "selected" : ""}`}
                    onClick={() => handleSelectTheme(t.id)}
                  >
                    <span
                      className="login-theme-dot"
                      style={{
                        background: t.bg,
                        borderColor: t.accent,
                      }}
                    >
                      <span style={{ background: t.accent }} />
                    </span>
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </header>

      <main id="main" className="login-main">
        {notice ? (
          <div className="notice" role="status">
            <span>{notice}</span>
            {onDismissNotice ? (
              <button
                type="button"
                className="text-button"
                onClick={onDismissNotice}
              >
                Dismiss
              </button>
            ) : null}
          </div>
        ) : null}

        <section className="login-card" aria-labelledby="login-heading">
          <div className="login-card-intro">
            <span className="login-eyebrow">FIRST-TIME SETUP</span>
            <h1 id="login-heading">Sign in with VTOP</h1>
            <p>
              Enter your VTOP username and password to sync attendance,
              timetable, marks, and exams directly to this device.
            </p>
          </div>

          {!online ? (
            <div className="login-offline-banner" role="status">
              <WifiOff size={16} />
              <span>
                You are offline. Connect to the internet to sign in with VTOP,
                or preview Demo Mode below.
              </span>
            </div>
          ) : null}

          <form onSubmit={sync.runSync} className="login-form">
            {sync.saved && !sync.editing ? (
              <div className="saved-login login-saved-box">
                <span className="saved-login-icon">
                  <LockKeyhole size={18} />
                </span>
                <div>
                  <strong>{sync.username}</strong>
                  <span>Saved on this device</span>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => sync.setEditing(true)}
                  disabled={sync.busy}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="login-fields">
                <label>
                  <span>VTOP Username</span>
                  <input
                    autoComplete="username"
                    name="username"
                    placeholder="Enter your VTOP login ID"
                    value={sync.username}
                    onChange={(e) =>
                      sync.setUsername(e.target.value.toUpperCase())
                    }
                    required
                    disabled={sync.busy || !sync.ready}
                  />
                </label>

                <label>
                  <span>Password</span>
                  <div className="password-field">
                    <input
                      type={sync.visible ? "text" : "password"}
                      autoComplete="current-password"
                      name="password"
                      placeholder="Enter your VTOP password"
                      value={sync.password}
                      onChange={(e) => sync.setPassword(e.target.value)}
                      required
                      disabled={sync.busy || !sync.ready}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={
                        sync.visible ? "Hide password" : "Show password"
                      }
                      onClick={() => sync.setVisible((v) => !v)}
                    >
                      {sync.visible ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>

                <label className="remember-login">
                  <input
                    type="checkbox"
                    checked={sync.remember}
                    onChange={(e) => sync.setRemember(e.target.checked)}
                    disabled={sync.busy}
                  />
                  <span>
                    Remember login on this device
                    <small>
                      Encrypted locally for 1-tap sync. No password leaves for
                      storage on any database.
                    </small>
                  </span>
                </label>
              </div>
            )}

            {sync.challenge && !sync.busy ? (
              <div className="verification-panel">
                <div className="captcha-label">
                  <span>Verify to continue</span>
                  <button
                    type="button"
                    className="text-button"
                    disabled={sync.busy}
                    onClick={sync.loadManualCaptcha}
                  >
                    <RefreshCw size={13} /> New image
                  </button>
                </div>
                <div className="captcha-box">
                  <img
                    src={sync.challenge.image}
                    alt="VTOP verification image. Check the six characters below."
                  />
                  <span className={sync.expired ? "warning" : ""}>
                    {sync.expired
                      ? "Expired — get a new image"
                      : "Enter the six characters shown"}
                  </span>
                </div>
                <label>
                  <span className="sr-only">Captcha text</span>
                  <input
                    name="captcha"
                    placeholder="Enter the 6 characters"
                    value={sync.captcha}
                    onChange={(e) =>
                      sync.setCaptcha(e.target.value.toUpperCase())
                    }
                    maxLength={6}
                    minLength={6}
                    required
                    autoFocus
                    disabled={sync.busy || sync.expired}
                    autoComplete="off"
                  />
                </label>
              </div>
            ) : null}

            {sync.error ? (
              <div className="form-message error" role="alert">
                {sync.error}
                {sync.errorCode === "GOOGLE_VERIFICATION_REQUIRED" ? (
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

            <button
              className="button primary full-width sync-primary login-submit-btn"
              type="submit"
              disabled={sync.busy || !online || !sync.ready}
              formNoValidate={!!sync.expired}
            >
              {sync.busy ? (
                <>
                  <LoaderCircle className="spinning" size={17} /> Syncing VTOP…
                </>
              ) : (
                <>
                  {sync.expired
                    ? "Get new captcha"
                    : sync.challenge
                      ? "Verify and sign in"
                      : "Sign in & Sync"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {!sync.challenge && sync.error ? (
              <button
                className="text-button manual-captcha"
                type="button"
                onClick={sync.loadManualCaptcha}
                disabled={sync.busy || !online || !sync.ready}
              >
                Enter captcha manually
              </button>
            ) : null}

            {sync.progress ? (
              <div className="sync-progress" role="status" aria-live="polite">
                {sync.progress}
              </div>
            ) : null}
          </form>

          <div className="login-secondary-row">
            <button
              type="button"
              className="text-button"
              onClick={onDemo}
              disabled={sync.busy}
            >
              Explore Demo
            </button>
            <a
              href="https://vtopcc.vit.ac.in/vtop/login"
              target="_blank"
              rel="noreferrer"
              className="login-ext-link"
            >
              Official VTOP <ArrowUpRight size={13} />
            </a>
          </div>
        </section>

        {!isStandalone && installPrompt ? (
          <section className="login-install-card" aria-label="Install Vtopia app">
            <div className="login-install-copy">
              <Smartphone size={18} />
              <div>
                <strong>Install Vtopia as an app</strong>
                <span>
                  Open full-screen from your home screen with offline access.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="button secondary login-install-btn"
              onClick={onInstallApp}
            >
              <Download size={15} />
              Install
            </button>
          </section>
        ) : !isStandalone && isIosInstallable ? (
          <section className="login-install-card" aria-label="Install on iPhone">
            <div className="login-install-copy">
              <Smartphone size={18} />
              <div>
                <strong>Install on iPhone / iPad</strong>
                <span>
                  Tap Safari’s Share button, then choose “Add to Home Screen”.
                </span>
              </div>
            </div>
          </section>
        ) : null}

        <div className="login-trust-strip">
          <span>
            <ShieldCheck size={13} /> Encrypted locally
          </span>
          <span>·</span>
          <span>Offline IndexedDB cache</span>
          <span>·</span>
          <span>No server database</span>
        </div>

        <footer className="author-credit login-author-credit">
          <a
            href="https://github.com/kailashp-27"
            target="_blank"
            rel="noreferrer"
            className="author-badge"
            title="View Kailash's GitHub profile"
          >
            <span>Developed by Kailash</span>
            <svg
              className="github-icon"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
        </footer>
      </main>
    </div>
  );
}
