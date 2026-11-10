import {
  ArrowRight,
  ArrowUpRight,
  Download,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { useVtopSync } from "../hooks/useVtopSync.js";

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

        {!online ? (
          <div className="login-topbar-actions">
            <span className="offline-tag login-offline-tag" role="status">
              <WifiOff size={14} />
              <span>Offline</span>
            </span>
          </div>
        ) : null}
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
            <h1 id="login-heading">Sign in with VTOP</h1>
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
                  <span>Remember login on this device</span>
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
            <ShieldCheck size={13} /> Offline IndexedDB cache
          </span>
        </div>
      </main>
    </div>
  );
}
