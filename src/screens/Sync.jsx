import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { readLogin, saveLogin, clearLogin } from "../credentials.js";
import {
  syncRequest,
  fetchCalendar,
  fetchCaptcha,
  fetchOverview,
} from "../api-client.js";
import { prepareVerification } from "../captcha-flow.js";

export default function Sync({
  online,
  onData,
  data,
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [remember, setRemember] = useState(false);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [progress, setProgress] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [captcha, setCaptcha] = useState("");
  const [manual, setManual] = useState(false);
  const [token, setToken] = useState(sessionToken || null);
  useEffect(() => {
    setToken(sessionToken || null);
  }, [sessionToken]);
  const [semesterId, setSemesterId] = useState(data?.semester?.id || "");
  const [now, setNow] = useState(Date.now());
  const abort = useRef(null);
  useEffect(() => {
    let active = true;
    readLogin()
      .then((login) => {
        if (active && login) {
          setUsername(login.username);
          setPassword(login.password);
          setSaved(true);
          setRemember(true);
        }
      })
      .catch(() => {
        if (active)
          setError("Saved login could not be opened. Please enter it again.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      clearInterval(timer);
      abort.current?.abort();
    };
  }, []);
  const expired = challenge && now >= challenge.expiresAt;
  async function storeLogin() {
    setSaving(true);
    setError("");
    try {
      await saveLogin(username.trim().toUpperCase(), password);
      setSaved(true);
      setRemember(true);
      setEditing(false);
      setProgress("Login saved on this device.");
    } catch {
      setError(
        "This browser could not save the login securely. You can still sync without saving.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function forgetLogin() {
    try {
      await clearLogin();
      setSaved(false);
      setRemember(false);
      setPassword("");
      setToken(null);
      onSession(null);
      setChallenge(null);
      setProgress("Saved login removed.");
    } catch {
      setError(
        "Could not remove the saved login. Clear this site’s data in browser settings.",
      );
    }
  }
  async function getChallenge(signal) {
    const result = await fetchCaptcha(signal);
    signal.throwIfAborted();
    setNow(Date.now());
    setChallenge(result);
    return result;
  }
  function showFailure(error) {
    setErrorCode(error.code || "");
    setError(
      error.name === "TimeoutError"
        ? "VTOP took too long. Please try again."
        : error.message || "Sync could not finish.",
    );
    setProgress("");
  }
  async function loadManualCaptcha() {
    if (busy || !online) return;
    setBusy(true);
    setError("");
    setErrorCode("");
    setChallenge(null);
    setCaptcha("");
    setManual(true);
    setProgress("Loading verification image…");
    const controller = new AbortController();
    abort.current = controller;
    try {
      await getChallenge(
        AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
      );
      setProgress("Enter the six characters, then tap Verify and sync.");
    } catch (error) {
      if (!controller.signal.aborted) showFailure(error);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function runSync(event) {
    const semesterOnly = !!token;
    event?.preventDefault();
    if (busy || !online) return;
    if ((!semesterOnly || !token) && (!username.trim() || !password)) {
      setError("Add your VTOP login in Settings before syncing.");
      onSettings();
      return;
    }
    setBusy(true);
    setError("");
    setErrorCode("");
    setProgress("Connecting to VTOP…");
    const controller = new AbortController();
    abort.current = controller;
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(115000),
    ]);
    let payload;
    try {
      if (semesterOnly && token) payload = { token, semesterId };
      else {
        if (!username.trim() || !password)
          throw new Error("Enter your VTOP username and password first.");
        const verification = await prepareVerification({
          challenge,
          answer: captcha,
          manual,
          load: () => getChallenge(signal),
          read: async (image) => {
            const { readCaptcha } = await import("../captcha-reader.js");
            return readCaptcha(image, { signal, onProgress: setProgress });
          },
        });
        signal.throwIfAborted();
        const active = verification.challenge;
        if (verification.needsManual || active.expiresAt <= Date.now()) {
          setManual(true);
          if (active.expiresAt <= Date.now()) await getChallenge(signal);
          setCaptcha("");
          setProgress(
            "Enter the six characters below, then tap Verify and sync.",
          );
          return;
        }
        if (remember) await saveLogin(username.trim().toUpperCase(), password);
        else if (saved) {
          await clearLogin();
          setSaved(false);
        }
        payload = {
          username: username.trim().toUpperCase(),
          password,
          captcha: verification.answer,
          token: active.token,
          ...(semesterId ? { semesterId } : {}),
        };
      }
      const result = await syncRequest(payload, setProgress, signal);
      if (payload) payload.password = "";
      setToken(result.token);
      onSession(result.token);
      setChallenge(null);
      setCaptcha("");
      setManual(false);
      setSemesterId(result.data.semester.id);
      if (remember) {
        setSaved(true);
        setEditing(false);
      } else setPassword("");
      await onData(result.data);
      let overviewFailed = false;
      setProgress("Fetching timetable, ODs and feedback status…");
      try {
        const extra = await fetchOverview(
          result.token,
          result.data.semester.id,
          AbortSignal.any([controller.signal, AbortSignal.timeout(110000)]),
        );
        const overview = extra.overview;
        await onOverview(overview, result.data.semester.id);
        if (extra.token) {
          result.token = extra.token;
          setToken(extra.token);
          onSession(extra.token);
        }
        overviewFailed =
          !overview.timetable?.available ||
          !overview.ods?.available ||
          !overview.feedback?.available ||
          !overview.exams?.available;
      } catch (error) {
        if (controller.signal.aborted) return;
        overviewFailed = true;
      }
      setProgress("Fetching academic calendar…");
      try {
        const calendar = await fetchCalendar(
          result.token,
          result.data.semester.id,
          AbortSignal.any([controller.signal, AbortSignal.timeout(110000)]),
        );
        await onCalendar(calendar, result.data.semester.id);
        setProgress(
          overviewFailed
            ? "Synced. Some overview details are unavailable from VTOP."
            : "Synced.",
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setProgress(
          "Attendance and marks synced. Academic calendar could not be fetched.",
        );
      }
    } catch (error) {
      setChallenge(null);
      setToken(null);
      onSession(null);
      setCaptcha("");
      if (!controller.signal.aborted) {
        showFailure(error);
        if (error.code === "INVALID_CAPTCHA") {
          // Obtain one fresh image and wait. Never retry the login automatically.
          setManual(true);
          setProgress("Loading a new image for manual entry…");
          try {
            await getChallenge(signal);
            setError(
              "VTOP rejected the captcha. Enter the new image’s six characters to try again.",
            );
            setProgress("");
          } catch (challengeError) {
            if (!controller.signal.aborted) showFailure(challengeError);
          }
        }
      }
    } finally {
      if (payload) payload.password = "";
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <div
      hidden={
        page === "courses" ||
        page === "exams" ||
        page === "simulator" ||
        page === "hostel-leave"
      }
      className={settings ? "sync-layout account-settings" : "sync-layout"}
    >
      <section className="sync-card">
        <div hidden={page === "semester"}>
          {settings ? (
            <h2 className="profile-section-title">VTOP account</h2>
          ) : null}
          {!settings ? (
            <div className="profile-identity">
              <h2>{data?.overview?.profile?.name || "Your profile"}</h2>
              <p>
                {data?.overview?.profile?.registration ||
                  (username
                    ? `Login: ${username}`
                    : "Name and register number appear after sync")}
              </p>
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
          page === "semester" ? (
            <div className="semester-form">
              <h2 className="profile-section-title">Select semester</h2>
              <label>
                Semester
                <select
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
                Choose a semester, then press Sync now to fetch it.
              </p>
            </div>
          ) : (
            <button
              type="button"
              className="profile-page-link"
              onClick={() => onNavigate("semester")}
            >
              Change semester <span aria-hidden="true">›</span>
            </button>
          )
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
