package com.kailash.vtopia;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

public class ClassWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        updateWidgets(context, appWidgetManager, appWidgetIds);
        WidgetScheduler.scheduleNext(context);
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        WidgetScheduler.scheduleNext(context);
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        WidgetScheduler.refreshAll(context);
    }

    public static void updateWidgets(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        WidgetState.Snapshot snapshot = WidgetState.loadSnapshot(context);
        WidgetState.ThemeColors t = snapshot.theme;
        WidgetState.ClassCard card = WidgetState.evaluateClass(snapshot, System.currentTimeMillis());

        int borderTint = card.isLive ? WidgetState.blendOver(t.accent, t.surface, 0.55f) : t.line;
        int statusPillBg = card.isLive
            ? t.accent
            : WidgetState.blendOver(t.text, t.surface, 0.08f);
        int statusPillText = card.isLive ? t.onAccent : t.text;

        Intent launch = new Intent(context, MainActivity.class);
        launch.setAction(Intent.ACTION_VIEW);
        launch.setData(Uri.parse("vtopia://navigate/overview"));
        launch.putExtra(MainActivity.EXTRA_WIDGET_TARGET, "overview");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent clickIntent = PendingIntent.getActivity(
            context,
            101,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        for (int widgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_class);
            views.setOnClickPendingIntent(R.id.class_widget_root, clickIntent);

            views.setInt(R.id.class_widget_border, "setColorFilter", borderTint);
            views.setInt(R.id.class_widget_surface, "setColorFilter", t.surface);

            views.setInt(R.id.class_status_bg, "setColorFilter", statusPillBg);
            views.setTextViewText(R.id.class_status_text, card.statusBadge);
            views.setTextColor(R.id.class_status_text, statusPillText);
            views.setViewVisibility(R.id.class_live_dot, card.isLive ? View.VISIBLE : View.GONE);
            views.setInt(R.id.class_live_dot, "setColorFilter", statusPillText);

            if (card.attendancePct != null) {
                int attColor = card.attendanceWarning ? t.statusDanger : t.statusGood;
                int attBg = WidgetState.blendOver(attColor, t.surface, 0.16f);
                views.setViewVisibility(R.id.class_att_container, View.VISIBLE);
                views.setInt(R.id.class_att_bg, "setColorFilter", attBg);
                views.setTextViewText(R.id.class_att_text, card.attendancePct);
                views.setTextColor(R.id.class_att_text, attColor);
            } else {
                views.setViewVisibility(R.id.class_att_container, View.GONE);
            }

            views.setTextViewText(R.id.class_title, card.title);
            views.setTextColor(R.id.class_title, t.text);

            views.setTextViewText(R.id.class_subtitle, card.subtitle);
            views.setTextColor(R.id.class_subtitle, t.muted);

            views.setTextViewText(R.id.class_venue, card.venue);
            views.setTextColor(R.id.class_venue, t.muted);

            views.setTextViewText(R.id.class_time, card.timing);
            views.setTextColor(R.id.class_time, card.isLive ? t.accent : t.text);

            manager.updateAppWidget(widgetId, views);
        }
    }
}
