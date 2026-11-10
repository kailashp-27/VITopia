import { useEffect, useRef, useState } from "react";
import { readLogin, saveLogin, clearLogin } from "../credentials.js";
import {
  syncRequest,
  fetchCalendar,
  fetchCaptcha,
  fetchOverview,
} from "../api-client.js";
import { prepareVerification } from "../captcha-flow.js";

export function useVtopSync({
  online,
  data,
  sessionToken,
  onData,
  onSession,
  onCalendar,
  onOverview,
  onSuccess,
  onStart,
  onFinish,
  onMissingCredentials,
  defaultRemember = false,
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [remember, setRemember] = useState(defaultRemember);
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
  const [semesterId, setSemesterId] = useState(data?.semester?.id || "");
  const [completed, setCompleted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const abort = useRef(null);

  useEffect(() => {
    setToken(sessionToken || null);
  }, [sessionToken]);

  useEffect(() => {
    if (data?.semester?.id && !semesterId) {
      setSemesterId(data.semester.id);
    }
  }, [data?.semester?.id, semesterId]);

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

  function abortSync() {
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
  }

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
      onSession?.(null);
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

  function showFailure(failure) {
    setErrorCode(failure.code || "");
    setError(
      failure.name === "TimeoutError"
        ? "VTOP took too long. Please try again."
        : failure.message || "Sync could not finish.",
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
    } catch (failure) {
      if (!controller.signal.aborted) showFailure(failure);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function buildCredentialPayload(signal, activeChallenge = challenge) {
    if (!username.trim() || !password)
      throw new Error("Enter your VTOP username and password first.");
    const verification = await prepareVerification({
      challenge: activeChallenge,
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
      setError("");
      setErrorCode("");
      setProgress("Enter the six characters below, then tap Verify and sync.");
      return null;
    }
    if (remember) {
      try {
        await saveLogin(username.trim().toUpperCase(), password);
      } catch {}
    } else if (saved) {
      try {
        await clearLogin();
      } catch {}
      setSaved(false);
    }
    return {
      username: username.trim().toUpperCase(),
      password,
      captcha: verification.answer,
      token: active.token,
      ...(semesterId ? { semesterId } : {}),
    };
  }

  async function runSync(event) {
    const semesterOnly = !!token;
    event?.preventDefault();
    if (busy || !online) return;
    if ((!semesterOnly || !token) && (!username.trim() || !password)) {
      setError("Add your VTOP login in Settings before syncing.");
      onMissingCredentials?.();
      return;
    }
    setBusy(true);
    setCompleted(false);
    setError("");
    setErrorCode("");
    setProgress("Connecting to VTOP…");
    onStart?.();
    const controller = new AbortController();
    abort.current = controller;
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(115000),
    ]);
    let payload;
    let didSucceed = false;
    try {
      if (semesterOnly && token) {
        payload = { token, semesterId };
      } else {
        payload = await buildCredentialPayload(signal);
        if (!payload) return;
      }

      let result;
      try {
        result = await syncRequest(payload, setProgress, signal);
      } catch (firstError) {
        if (
          semesterOnly &&
          firstError.code === "SESSION_EXPIRED" &&
          !controller.signal.aborted &&
          username.trim() &&
          password
        ) {
          setToken(null);
          onSession?.(null);
          setProgress("Session expired — signing in again…");
          payload = await buildCredentialPayload(signal, null);
          if (!payload) return;
          result = await syncRequest(payload, setProgress, signal);
        } else {
          throw firstError;
        }
      }

      if (payload) payload.password = "";
      setToken(result.token);
      onSession?.(result.token);
      setChallenge(null);
      setCaptcha("");
      setManual(false);
      setSemesterId(result.data.semester.id);
      if (remember) {
        setSaved(true);
        setEditing(false);
      } else setPassword("");
      await onData?.(result.data);

      let overviewFailed = false;
      setProgress("Fetching timetable, ODs and feedback status…");
      try {
        const extra = await fetchOverview(
          result.token,
          result.data.semester.id,
          AbortSignal.any([controller.signal, AbortSignal.timeout(110000)]),
        );
        const overview = extra.overview;
        await onOverview?.(overview, result.data.semester.id);
        if (extra.token) {
          result.token = extra.token;
          setToken(extra.token);
          onSession?.(extra.token);
        }
        overviewFailed =
          !overview.timetable?.available ||
          !overview.ods?.available ||
          !overview.feedback?.available ||
          !overview.exams?.available;
      } catch {
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
        await onCalendar?.(calendar, result.data.semester.id);
        setProgress(
          overviewFailed
            ? "Synced. Some overview details are unavailable from VTOP."
            : "Synced.",
        );
      } catch {
        if (controller.signal.aborted) return;
        setProgress(
          "Attendance and marks synced. Academic calendar could not be fetched.",
        );
      }
      setCompleted(true);
      didSucceed = true;
      onSuccess?.();
    } catch (failure) {
      setToken(null);
      onSession?.(null);
      setCaptcha("");
      if (!controller.signal.aborted) {
        if (
          failure.code === "INVALID_CAPTCHA" ||
          failure.code === "CAPTCHA_UNSUPPORTED"
        ) {
          setManual(true);
          setError("");
          setErrorCode("");
          setProgress("Loading verification image…");
          try {
            const freshController = new AbortController();
            const freshSignal = AbortSignal.any([
              freshController.signal,
              AbortSignal.timeout(20000),
            ]);
            await getChallenge(freshSignal);
            setProgress(
              "Enter the six characters from the image below to sign in.",
            );
          } catch {
            setProgress(
              "Enter the six characters from the image below to sign in.",
            );
          }
        } else {
          showFailure(failure);
        }
      }
    } finally {
      if (payload) payload.password = "";
      if (!controller.signal.aborted) {
        setBusy(false);
        onFinish?.(didSucceed);
      }
    }
  }

  return {
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
    token,
    semesterId,
    setSemesterId,
    completed,
    storeLogin,
    forgetLogin,
    loadManualCaptcha,
    runSync,
    abortSync,
  };
}
