import { CookieJar } from "tough-cookie";
import { load } from "cheerio";
import { AppError } from "./errors.js";
import {
  csrfFrom,
  authFrom,
  parseSemesters,
  parseAttendance,
  parseMarks,
} from "./parsers.js";
import { vtopFetch } from "./tls.js";
export const BASE = "https://vtopcc.vit.ac.in/vtop/";
export class VtopClient {
  constructor(session = {}, fetcher = vtopFetch) {
    this.jar = session.cookies
      ? CookieJar.deserializeSync(session.cookies)
      : new CookieJar();
    this.csrf = session.csrf;
    this.authorizedID = session.authorizedID;
    this.fetcher = fetcher;
  }
  snapshot() {
    return {
      cookies: this.jar.serializeSync(),
      csrf: this.csrf,
      authorizedID: this.authorizedID,
    };
  }
  async request(path, form, redirects = 0) {
    const url = new URL(path, BASE);
    if (
      url.origin !== new URL(BASE).origin ||
      !url.pathname.startsWith("/vtop/")
    )
      throw new AppError(
        "UPSTREAM_REDIRECT",
        "VTOP redirected outside the student portal.",
        502,
      );
    let response;
    try {
      response = await this.fetcher(url, {
        method: form ? "POST" : "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(18000),
        headers: {
          "User-Agent": "Mozilla/5.0 Vtopia/0.1",
          Accept: "text/html",
          Referer: BASE + "login",
          Cookie: await this.jar.getCookieString(url.href),
          ...(form
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
        },
        body: form ? new URLSearchParams(form) : undefined,
      });
    } catch {
      throw new AppError(
        "VTOP_UNAVAILABLE",
        "VTOP could not be reached. Please try again shortly.",
        502,
      );
    }
    for (const cookie of response.headers.getSetCookie())
      await this.jar.setCookie(cookie, url.href);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects >= 5 || !response.headers.get("location"))
        throw new AppError(
          "VTOP_UNAVAILABLE",
          "VTOP returned too many redirects.",
          502,
        );
      return this.request(
        new URL(response.headers.get("location"), url).href,
        [307, 308].includes(response.status) ? form : undefined,
        redirects + 1,
      );
    }
    if (!response.ok)
      throw new AppError(
        "VTOP_UNAVAILABLE",
        response.status === 429
          ? "VTOP is receiving too many requests. Wait a minute before retrying."
          : "VTOP is temporarily unavailable. Try a fresh captcha.",
        502,
      );
    const html = await response.text();
    this.csrf = csrfFrom(html) || this.csrf;
    return html;
  }
  async captcha() {
    await this.request("login");
    if (!this.csrf)
      throw new AppError(
        "PORTAL_CHANGED",
        "VTOP did not return a login session.",
        502,
      );
    const html = await this.request("prelogin/setup", {
      _csrf: this.csrf,
      flag: "VTOP",
    });
    const $ = load(html);
    const image = $("#captchaBlock img").attr("src");
    if (
      !image ||
      !/^data:image\/(png|jpe?g);base64,[a-zA-Z0-9+/=]+$/.test(image)
    ) {
      if ($("[data-sitekey]").length)
        throw new AppError(
          "GOOGLE_VERIFICATION_REQUIRED",
          "VTOP returned Google reCAPTCHA instead of an image captcha. This challenge must be completed on the official VTOP portal. Signing in there does not sign Vtopia in.",
          503,
        );
      throw new AppError(
        "CAPTCHA_UNSUPPORTED",
        "VTOP did not return an image captcha. Try again later.",
        503,
      );
    }
    return image;
  }
  async login(username, password, captcha) {
    const html = await this.request("login", {
      _csrf: this.csrf,
      username: username.toUpperCase(),
      password,
      captchaStr: captcha.toUpperCase(),
    });
    this.authorizedID = authFrom(html);
    if (this.authorizedID) return;
    const text = load(html)("body").text();
    if (
      /invalid.*captcha|captcha.*(invalid|incorrect)|check.*captcha/i.test(text)
    )
      throw new AppError(
        "INVALID_CAPTCHA",
        "That captcha did not match. Load a new one and try again.",
        401,
      );
    if (/locked|maximum.*attempt/i.test(text))
      throw new AppError(
        "ACCOUNT_LOCKED",
        "VTOP has locked sign-in attempts. Please use the official portal.",
        403,
      );
    if (/invalid.*(user|password)|incorrect.*(user|password)/i.test(text))
      throw new AppError(
        "INVALID_CREDENTIALS",
        "VTOP did not accept the username or password.",
        401,
      );
    this.authorizedID = authFrom(await this.request("content"));
    if (!this.authorizedID)
      throw new AppError(
        "LOGIN_FAILED",
        "VTOP did not complete sign-in. Check your details and try a fresh captcha.",
        401,
      );
  }
  async authenticated(path, payload = {}) {
    if (!this.authorizedID)
      throw new AppError(
        "SESSION_EXPIRED",
        "Sign in with a fresh captcha.",
        401,
      );
    const html = await this.request(path, {
      authorizedID: this.authorizedID,
      _csrf: this.csrf,
      ...payload,
      x: new Date().toUTCString(),
    });
    if (
      load(html)("#vtopLoginForm").length ||
      /your session has expired|session is expired/i.test(
        load(html)("body").text(),
      )
    )
      throw new AppError(
        "SESSION_EXPIRED",
        "VTOP ended your session. Sign in again.",
        401,
      );
    return html;
  }
  async semesters() {
    return parseSemesters(
      await this.authenticated("academics/common/StudentTimeTableChn", {
        verifyMenu: "true",
        nocache: String(Date.now()),
      }),
    );
  }
  async chooseSemester(semesters, requested) {
    if (requested) {
      const match = semesters.find((s) => s.id === requested);
      if (!match)
        throw new AppError(
          "INVALID_SEMESTER",
          "Select a semester from the available list.",
        );
      return match;
    }
    for (const semester of semesters.slice(0, 3)) {
      const html = await this.authenticated("processViewTimeTable", {
        semesterSubId: semester.id,
      });
      if (/\b[A-Z]{3,5}\d{3,4}[A-Z]?\b/.test(load(html)("table").text()))
        return semester;
    }
    if (!semesters.length)
      throw new AppError(
        "NO_SEMESTER",
        "No semesters were available for this account.",
        422,
      );
    return semesters[0];
  }
  async fetchData(semester, progress) {
    progress("attendance", "Fetching attendance");
    await this.authenticated("academics/common/StudentAttendance", {
      verifyMenu: "true",
    });
    const attendance = parseAttendance(
      await this.authenticated("processViewStudentAttendance", {
        semesterSubId: semester.id,
      }),
    );
    progress("marks", "Fetching marks");
    await this.authenticated("examinations/StudentMarkView", {
      verifyMenu: "true",
    });
    const marks = parseMarks(
      await this.authenticated("examinations/doStudentMarkView", {
        semesterSubId: semester.id,
      }),
    );
    return { syncedAt: new Date().toISOString(), semester, attendance, marks };
  }
}
