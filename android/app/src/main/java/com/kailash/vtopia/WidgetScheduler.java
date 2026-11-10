package com.kailash.vtopia;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public final class WidgetScheduler {
    public static final String ACTION_WIDGET_TICK = "com.kailash.vtopia.ACTION_WIDGET_TICK";

    private WidgetScheduler() {}

    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;

        int[] classIds = manager.getAppWidgetIds(new ComponentName(context, ClassWidgetProvider.class));
        if (classIds != null && classIds.length > 0) {
            ClassWidgetProvider.updateWidgets(context, manager, classIds);
        }

        int[] examIds = manager.getAppWidgetIds(new ComponentName(context, ExamWidgetProvider.class));
        if (examIds != null && examIds.length > 0) {
            ExamWidgetProvider.updateWidgets(context, manager, examIds);
        }

        boolean anyActive = (classIds != null && classIds.length > 0) || (examIds != null && examIds.length > 0);
        if (anyActive) {
            scheduleNext(context);
        } else {
            cancel(context);
        }
    }

    public static void scheduleNext(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        long now = System.currentTimeMillis();
        WidgetState.Snapshot snapshot = WidgetState.loadSnapshot(context);
        WidgetState.ClassCard card = WidgetState.evaluateClass(snapshot, now);
        long triggerAt = Math.max(now + 20_000L, card.nextBoundaryMillis);

        PendingIntent pi = tickPendingIntent(context);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC, triggerAt, pi);
            } else {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC, triggerAt, pi);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC, triggerAt, pi);
        } else {
            alarmManager.setExact(AlarmManager.RTC, triggerAt, pi);
        }
    }

    public static void cancel(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.cancel(tickPendingIntent(context));
        }
    }

    private static PendingIntent tickPendingIntent(Context context) {
        Intent intent = new Intent(context, WidgetRefreshReceiver.class);
        intent.setAction(ACTION_WIDGET_TICK);
        return PendingIntent.getBroadcast(
            context,
            2001,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
