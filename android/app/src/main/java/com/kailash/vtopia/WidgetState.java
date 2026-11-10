package com.kailash.vtopia;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

public final class WidgetState {
    private static final String PREFS_NAME = "vtopia_widget_store";
    private static final String KEY_SNAPSHOT = "snapshot_json";
    private static final TimeZone IST = TimeZone.getTimeZone("Asia/Kolkata");
    private static final String[] DAYS = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"};
    private static final Pattern TIME_PATTERN = Pattern.compile("(\\d{1,2}):(\\d{2})");
    private static final Map<String, Integer> MONTHS = createMonthMap();

    private WidgetState() {}

    private static Map<String, Integer> createMonthMap() {
        Map<String, Integer> m = new HashMap<>();
        m.put("jan", 0);
        m.put("feb", 1);
        m.put("mar", 2);
        m.put("apr", 3);
        m.put("may", 4);
        m.put("jun", 5);
        m.put("jul", 6);
        m.put("aug", 7);
        m.put("sep", 8);
        m.put("oct", 9);
        m.put("nov", 10);
        m.put("dec", 11);
        return m;
    }

    public static void saveSnapshot(Context context, String json) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        if (json == null || json.trim().isEmpty()) {
            prefs.edit().remove(KEY_SNAPSHOT).apply();
        } else {
            prefs.edit().putString(KEY_SNAPSHOT, json).apply();
        }
    }

    public static Snapshot loadSnapshot(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_SNAPSHOT, null);
        return parseSnapshot(raw);
    }

    public static int blendOver(int fgColor, int bgColor, float alpha) {
        float inv = 1f - alpha;
        int r = Math.round(Color.red(fgColor) * alpha + Color.red(bgColor) * inv);
        int g = Math.round(Color.green(fgColor) * alpha + Color.green(bgColor) * inv);
        int b = Math.round(Color.blue(fgColor) * alpha + Color.blue(bgColor) * inv);
        return Color.argb(255, Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b)));
    }

    public static final class ThemeColors {
        public final int bg;
        public final int surface;
        public final int surfaceAlt;
        public final int line;
        public final int text;
        public final int muted;
        public final int accent;
        public final int onAccent;
        public final int amber;
        public final int statusDanger;
        public final int statusGood;
        public final boolean isLight;

        public ThemeColors(
            int bg,
            int surface,
            int surfaceAlt,
            int line,
            int text,
            int muted,
            int accent,
            int onAccent,
            int amber,
            int statusDanger,
            int statusGood,
            boolean isLight
        ) {
            this.bg = bg;
            this.surface = surface;
            this.surfaceAlt = surfaceAlt;
            this.line = line;
            this.text = text;
            this.muted = muted;
            this.accent = accent;
            this.onAccent = onAccent;
            this.amber = amber;
            this.statusDanger = statusDanger;
            this.statusGood = statusGood;
            this.isLight = isLight;
        }

        public static ThemeColors defaults() {
            return new ThemeColors(
                Color.parseColor("#000000"),
                Color.parseColor("#0d0d0d"),
                Color.parseColor("#161616"),
                Color.parseColor("#262626"),
                Color.parseColor("#f5f5f5"),
                Color.parseColor("#888888"),
                Color.parseColor("#a855f7"),
                Color.parseColor("#ffffff"),
                Color.parseColor("#eabd9a"),
                Color.parseColor("#f87171"),
                Color.parseColor("#4ade80"),
                false
            );
        }

        static ThemeColors fromJson(JSONObject obj) {
            ThemeColors d = defaults();
            if (obj == null) return d;
            return new ThemeColors(
                parseColor(obj.optString("bg", ""), d.bg),
                parseColor(obj.optString("surface", ""), d.surface),
                parseColor(obj.optString("surfaceAlt", ""), d.surfaceAlt),
                parseColor(obj.optString("line", ""), d.line),
                parseColor(obj.optString("text", ""), d.text),
                parseColor(obj.optString("muted", ""), d.muted),
                parseColor(obj.optString("accent", ""), d.accent),
                parseColor(obj.optString("onAccent", ""), d.onAccent),
                parseColor(obj.optString("amber", ""), d.amber),
                parseColor(obj.optString("statusDanger", ""), d.statusDanger),
                parseColor(obj.optString("statusGood", ""), d.statusGood),
                obj.optBoolean("isLight", d.isLight)
            );
        }
    }

    public static final class ClassItem {
        public final String day;
        public final String start;
        public final String end;
        public final String code;
        public final String title;
        public final String slot;
        public final String venue;
        public final String attendancePct;
        public final boolean attendanceWarning;

        ClassItem(
            String day,
            String start,
            String end,
            String code,
            String title,
            String slot,
            String venue,
            String attendancePct,
            boolean attendanceWarning
        ) {
            this.day = day;
            this.start = start;
            this.end = end;
            this.code = code;
            this.title = title;
            this.slot = slot;
            this.venue = venue;
            this.attendancePct = attendancePct;
            this.attendanceWarning = attendanceWarning;
        }
    }

    public static final class CalendarDay {
        public final String date;
        public final String status;
        public final String dayOrder;

        CalendarDay(String date, String status, String dayOrder) {
            this.date = date;
            this.status = status;
            this.dayOrder = dayOrder;
        }
    }

    public static final class ExamItem {
        public final String examType;
        public final String code;
        public final String title;
        public final String date;
        public final String time;
        public final String venue;
        public final String seat;

        ExamItem(String examType, String code, String title, String date, String time, String venue, String seat) {
            this.examType = examType;
            this.code = code;
            this.title = title;
            this.date = date;
            this.time = time;
            this.venue = venue;
            this.seat = seat;
        }
    }

    public static final class Snapshot {
        public final boolean hasData;
        public final ThemeColors theme;
        public final boolean timetableAvailable;
        public final List<ClassItem> classes;
        public final Map<String, CalendarDay> calendarByDate;
        public final boolean examsAvailable;
        public final List<ExamItem> exams;

        Snapshot(
            boolean hasData,
            ThemeColors theme,
            boolean timetableAvailable,
            List<ClassItem> classes,
            Map<String, CalendarDay> calendarByDate,
            boolean examsAvailable,
            List<ExamItem> exams
        ) {
            this.hasData = hasData;
            this.theme = theme;
            this.timetableAvailable = timetableAvailable;
            this.classes = classes;
            this.calendarByDate = calendarByDate;
            this.examsAvailable = examsAvailable;
            this.exams = exams;
        }
    }

    public static final class ClassCard {
        public final String statusBadge;
        public final boolean isLive;
        public final String attendancePct;
        public final boolean attendanceWarning;
        public final String title;
        public final String subtitle;
        public final String venue;
        public final String timing;
        public final long nextBoundaryMillis;

        ClassCard(
            String statusBadge,
            boolean isLive,
            String attendancePct,
            boolean attendanceWarning,
            String title,
            String subtitle,
            String venue,
            String timing,
            long nextBoundaryMillis
        ) {
            this.statusBadge = statusBadge;
            this.isLive = isLive;
            this.attendancePct = attendancePct;
            this.attendanceWarning = attendanceWarning;
            this.title = title;
            this.subtitle = subtitle;
            this.venue = venue;
            this.timing = timing;
            this.nextBoundaryMillis = nextBoundaryMillis;
        }
    }

    public static final class ExamCard {
        public final String examType;
        public final String countdown;
        public final boolean isUrgent;
        public final boolean isDone;
        public final String title;
        public final String subtitle;
        public final String venue;
        public final String seatOrAction;
        public final boolean hasSeat;

        ExamCard(
            String examType,
            String countdown,
            boolean isUrgent,
            boolean isDone,
            String title,
            String subtitle,
            String venue,
            String seatOrAction,
            boolean hasSeat
        ) {
            this.examType = examType;
            this.countdown = countdown;
            this.isUrgent = isUrgent;
            this.isDone = isDone;
            this.title = title;
            this.subtitle = subtitle;
            this.venue = venue;
            this.seatOrAction = seatOrAction;
            this.hasSeat = hasSeat;
        }
    }

    private static Snapshot parseSnapshot(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return new Snapshot(
                false,
                ThemeColors.defaults(),
                false,
                Collections.emptyList(),
                Collections.emptyMap(),
                false,
                Collections.emptyList()
            );
        }
        try {
            JSONObject root = new JSONObject(raw);
            ThemeColors theme = ThemeColors.fromJson(root.optJSONObject("theme"));
            boolean hasData = root.optBoolean("hasData", false);
            boolean timetableAvailable = root.optBoolean("timetableAvailable", false);
            boolean examsAvailable = root.optBoolean("examsAvailable", false);

            List<ClassItem> classes = new ArrayList<>();
            JSONArray classArr = root.optJSONArray("classes");
            if (classArr != null) {
                for (int i = 0; i < classArr.length(); i++) {
                    JSONObject obj = classArr.optJSONObject(i);
                    if (obj == null) continue;
                    String pct = obj.isNull("attendancePct") ? null : obj.optString("attendancePct", null);
                    if (pct != null && pct.trim().isEmpty()) pct = null;
                    classes.add(
                        new ClassItem(
                            obj.optString("day", ""),
                            obj.optString("start", ""),
                            obj.optString("end", ""),
                            obj.optString("code", ""),
                            obj.optString("title", ""),
                            obj.optString("slot", ""),
                            obj.optString("venue", "Room not listed"),
                            pct,
                            obj.optBoolean("attendanceWarning", false)
                        )
                    );
                }
            }

            Map<String, CalendarDay> calMap = new HashMap<>();
            JSONArray calArr = root.optJSONArray("calendarDays");
            if (calArr != null) {
                for (int i = 0; i < calArr.length(); i++) {
                    JSONObject obj = calArr.optJSONObject(i);
                    if (obj == null) continue;
                    String date = obj.optString("date", "");
                    if (!date.isEmpty()) {
                        calMap.put(
                            date,
                            new CalendarDay(
                                date,
                                obj.optString("status", "unknown"),
                                obj.optString("dayOrder", "")
                            )
                        );
                    }
                }
            }

            List<ExamItem> exams = new ArrayList<>();
            JSONArray examArr = root.optJSONArray("exams");
            if (examArr != null) {
                for (int i = 0; i < examArr.length(); i++) {
                    JSONObject obj = examArr.optJSONObject(i);
                    if (obj == null) continue;
                    exams.add(
                        new ExamItem(
                            obj.optString("examType", "EXAMS"),
                            obj.optString("code", ""),
                            obj.optString("title", ""),
                            obj.optString("date", ""),
                            obj.optString("time", ""),
                            obj.optString("venue", "Venue pending"),
                            obj.optString("seat", "")
                        )
                    );
                }
            }

            return new Snapshot(hasData, theme, timetableAvailable, classes, calMap, examsAvailable, exams);
        } catch (Exception ignored) {
            return new Snapshot(
                false,
                ThemeColors.defaults(),
                false,
                Collections.emptyList(),
                Collections.emptyMap(),
                false,
                Collections.emptyList()
            );
        }
    }

    public static ClassCard evaluateClass(Snapshot snapshot, long nowMillis) {
        long nextMidnight = nextMidnightIST(nowMillis);
        if (!snapshot.hasData) {
            return new ClassCard("SETUP", false, null, false, "Vtopia", "Tap to sign in & sync", "VTOP offline cache", "—", nextMidnight);
        }
        if (!snapshot.timetableAvailable) {
            return new ClassCard("SYNC", false, null, false, "Timetable", "Sync in Profile", "Not synced yet", "—", nextMidnight);
        }

        Calendar cal = Calendar.getInstance(IST, Locale.ENGLISH);
        cal.setTimeInMillis(nowMillis);
        int nowMinutes = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);

        for (int offset = 0; offset <= 14; offset++) {
            Calendar dayCal = (Calendar) cal.clone();
            dayCal.add(Calendar.DAY_OF_MONTH, offset);
            String isoDate = formatIsoDate(dayCal);
            CalendarDay academic = snapshot.calendarByDate.get(isoDate);
            if (academic != null && "holiday".equals(academic.status)) {
                continue;
            }

            String dayKey = weekdayKey(dayCal.get(Calendar.DAY_OF_WEEK));
            if (academic != null && "working".equals(academic.status) && !academic.dayOrder.isEmpty()) {
                dayKey = academic.dayOrder;
            }

            List<ClassItem> dayClasses = new ArrayList<>();
            for (ClassItem c : snapshot.classes) {
                if (dayKey.equalsIgnoreCase(c.day)) {
                    dayClasses.add(c);
                }
            }
            Collections.sort(dayClasses, Comparator.comparing(a -> a.start));

            if (dayClasses.isEmpty()) continue;

            if (offset == 0) {
                for (ClassItem c : dayClasses) {
                    int s = toMinutes(c.start);
                    int e = toMinutes(c.end);
                    if (s >= 0 && e > s && nowMinutes >= s && nowMinutes < e) {
                        long endBoundary = millisAtMinutesIST(dayCal, e);
                        return new ClassCard(
                            "NOW",
                            true,
                            c.attendancePct != null ? c.attendancePct + "%" : null,
                            c.attendanceWarning,
                            nonEmpty(c.title, c.code),
                            joinDot(c.code, c.slot),
                            nonEmpty(c.venue, "Room not listed"),
                            c.start + " - " + c.end,
                            endBoundary > nowMillis ? endBoundary : nextMidnight
                        );
                    }
                }
                for (ClassItem c : dayClasses) {
                    int s = toMinutes(c.start);
                    if (s >= 0 && nowMinutes < s) {
                        long startBoundary = millisAtMinutesIST(dayCal, s);
                        return new ClassCard(
                            "NEXT",
                            false,
                            c.attendancePct != null ? c.attendancePct + "%" : null,
                            c.attendanceWarning,
                            nonEmpty(c.title, c.code),
                            joinDot(c.code, c.slot),
                            nonEmpty(c.venue, "Room not listed"),
                            c.start + " - " + c.end,
                            startBoundary > nowMillis ? startBoundary : nextMidnight
                        );
                    }
                }
            } else {
                ClassItem first = dayClasses.get(0);
                SimpleDateFormat fmt = new SimpleDateFormat("EEE, d MMM", Locale.ENGLISH);
                fmt.setTimeZone(IST);
                String dateLabel = fmt.format(dayCal.getTime());
                return new ClassCard(
                    dateLabel,
                    false,
                    first.attendancePct != null ? first.attendancePct + "%" : null,
                    first.attendanceWarning,
                    nonEmpty(first.title, first.code),
                    joinDot(first.code, first.slot),
                    nonEmpty(first.venue, "Room not listed"),
                    first.start + " - " + first.end,
                    nextMidnight
                );
            }
        }

        return new ClassCard("FREE", false, null, false, "No upcoming classes", "Enjoy your break", "Schedule clear", "—", nextMidnight);
    }

    public static ExamCard evaluateExam(Snapshot snapshot, long nowMillis) {
        if (!snapshot.hasData) {
            return new ExamCard("EXAMS", null, false, false, "Vtopia", "Tap to sign in & sync", "VTOP offline cache", "Open", false);
        }
        if (!snapshot.examsAvailable) {
            return new ExamCard("EXAMS", null, false, false, "Exam schedule", "Sync in Profile", "—", "View ›", false);
        }
        if (snapshot.exams.isEmpty()) {
            return new ExamCard("EXAMS", null, false, false, "No exams scheduled", "You're all clear!", "—", "View ›", false);
        }

        List<ExamItem> future = new ArrayList<>();
        Map<ExamItem, Long> parsedTimes = new HashMap<>();
        for (ExamItem item : snapshot.exams) {
            Long millis = parseExamDateMillis(item.date, item.time);
            parsedTimes.put(item, millis);
            if (millis != null && millis >= nowMillis - 3L * 3600L * 1000L) {
                future.add(item);
            }
        }
        Collections.sort(future, (a, b) -> {
            Long ta = parsedTimes.get(a);
            Long tb = parsedTimes.get(b);
            return Long.compare(ta != null ? ta : Long.MAX_VALUE, tb != null ? tb : Long.MAX_VALUE);
        });

        ExamItem target = !future.isEmpty() ? future.get(0) : snapshot.exams.get(0);
        Long targetMillis = parsedTimes.get(target);
        String countdown = null;
        boolean isUrgent = false;
        boolean isDone = false;

        if (targetMillis != null) {
            long targetMid = midnightMillisIST(targetMillis);
            long nowMid = midnightMillisIST(nowMillis);
            long diffDays = Math.round((targetMid - nowMid) / 86400000.0);
            if (diffDays == 0) {
                countdown = "Today";
                isUrgent = true;
            } else if (diffDays == 1) {
                countdown = "Tomorrow";
                isUrgent = true;
            } else if (diffDays > 1) {
                countdown = "In " + diffDays + "d";
            } else {
                countdown = "Done";
                isDone = true;
            }
        }

        String dateStr = nonEmpty(target.date, "Date pending");
        String subtitle = target.time != null && !target.time.isEmpty() ? dateStr + " · " + target.time : dateStr;
        boolean hasSeat = target.seat != null && !target.seat.trim().isEmpty();

        return new ExamCard(
            nonEmpty(target.examType, "EXAMS"),
            countdown,
            isUrgent,
            isDone,
            nonEmpty(target.title, nonEmpty(target.code, "Examination")),
            subtitle,
            nonEmpty(target.venue, "Venue pending"),
            hasSeat ? target.seat : "View ›",
            hasSeat
        );
    }

    private static Long parseExamDateMillis(String dateStr, String timeStr) {
        if (dateStr == null || dateStr.trim().isEmpty() || dateStr.toLowerCase(Locale.ENGLISH).contains("pending")) {
            return null;
        }
        String[] parts = dateStr.trim().split("[- /.]+");
        Integer year = null;
        Integer month = null;
        Integer day = null;
        if (parts.length == 3) {
            try {
                if (parts[0].length() == 4) {
                    year = Integer.parseInt(parts[0]);
                    month = parseMonthPart(parts[1]);
                    day = Integer.parseInt(parts[2]);
                } else {
                    day = Integer.parseInt(parts[0]);
                    month = parseMonthPart(parts[1]);
                    year = Integer.parseInt(parts[2]);
                }
            } catch (Exception ignored) {
                year = null;
            }
        }
        if (year == null || month == null || day == null) return null;

        int hour = 9;
        int minute = 0;
        if (timeStr != null && !timeStr.isEmpty()) {
            Matcher m = TIME_PATTERN.matcher(timeStr);
            if (m.find()) {
                try {
                    hour = Integer.parseInt(m.group(1));
                    minute = Integer.parseInt(m.group(2));
                    String lower = timeStr.toLowerCase(Locale.ENGLISH);
                    if (lower.contains("pm") && hour < 12) hour += 12;
                    if (lower.contains("am") && hour == 12) hour = 0;
                } catch (Exception ignored) {
                    hour = 9;
                    minute = 0;
                }
            }
        }

        Calendar c = Calendar.getInstance(IST, Locale.ENGLISH);
        c.set(year, month, day, hour, minute, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static Integer parseMonthPart(String raw) {
        if (raw == null || raw.isEmpty()) return null;
        try {
            return Integer.parseInt(raw) - 1;
        } catch (NumberFormatException ignored) {
            String key = raw.toLowerCase(Locale.ENGLISH);
            if (key.length() > 3) key = key.substring(0, 3);
            return MONTHS.get(key);
        }
    }

    private static long midnightMillisIST(long millis) {
        Calendar c = Calendar.getInstance(IST, Locale.ENGLISH);
        c.setTimeInMillis(millis);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static long nextMidnightIST(long nowMillis) {
        Calendar c = Calendar.getInstance(IST, Locale.ENGLISH);
        c.setTimeInMillis(nowMillis);
        c.add(Calendar.DAY_OF_MONTH, 1);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 5);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static long millisAtMinutesIST(Calendar dayCal, int totalMinutes) {
        Calendar c = (Calendar) dayCal.clone();
        c.set(Calendar.HOUR_OF_DAY, totalMinutes / 60);
        c.set(Calendar.MINUTE, totalMinutes % 60);
        c.set(Calendar.SECOND, 5);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static String formatIsoDate(Calendar c) {
        return String.format(
            Locale.ENGLISH,
            "%04d-%02d-%02d",
            c.get(Calendar.YEAR),
            c.get(Calendar.MONTH) + 1,
            c.get(Calendar.DAY_OF_MONTH)
        );
    }

    private static String weekdayKey(int dayOfWeek) {
        int idx = (dayOfWeek + 5) % 7;
        return DAYS[idx];
    }

    private static int toMinutes(String clock) {
        if (clock == null || !clock.contains(":")) return -1;
        try {
            String[] p = clock.trim().split(":");
            return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
        } catch (Exception ignored) {
            return -1;
        }
    }

    private static String nonEmpty(String val, String fallback) {
        return val != null && !val.trim().isEmpty() ? val.trim() : fallback;
    }

    private static String joinDot(String a, String b) {
        boolean hasA = a != null && !a.trim().isEmpty();
        boolean hasB = b != null && !b.trim().isEmpty();
        if (hasA && hasB) return a.trim() + " · " + b.trim();
        if (hasA) return a.trim();
        if (hasB) return b.trim();
        return "";
    }

    private static int parseColor(String hex, int fallback) {
        if (hex == null || hex.trim().isEmpty()) return fallback;
        try {
            return Color.parseColor(hex.trim());
        } catch (Exception ignored) {
            return fallback;
        }
    }
}
