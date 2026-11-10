package com.kailash.vtopia;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

public class ExamWidgetProvider extends AppWidgetProvider {

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
        WidgetState.ExamCard card = WidgetState.evaluateExam(snapshot, System.currentTimeMillis());

        int typeBg = WidgetState.blendOver(t.accent, t.surface, 0.16f);

        Intent launch = new Intent(context, MainActivity.class);
        launch.setAction(Intent.ACTION_VIEW);
        launch.setData(Uri.parse("vtopia://navigate/exams"));
        launch.putExtra(MainActivity.EXTRA_WIDGET_TARGET, "exams");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent clickIntent = PendingIntent.getActivity(
            context,
            102,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        for (int widgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_exam);
            views.setOnClickPendingIntent(R.id.exam_widget_root, clickIntent);

            views.setInt(R.id.exam_widget_border, "setColorFilter", t.line);
            views.setInt(R.id.exam_widget_surface, "setColorFilter", t.surface);

            views.setInt(R.id.exam_type_bg, "setColorFilter", typeBg);
            views.setTextViewText(R.id.exam_type_text, card.examType);
            views.setTextColor(R.id.exam_type_text, t.accent);

            if (card.countdown != null && !card.countdown.isEmpty()) {
                int cdFg = card.isUrgent ? t.statusDanger : (card.isDone ? t.muted : t.accent);
                int cdBg = card.isUrgent
                    ? WidgetState.blendOver(t.statusDanger, t.surface, 0.16f)
                    : (card.isDone ? t.surfaceAlt : WidgetState.blendOver(t.accent, t.surface, 0.14f));
                views.setViewVisibility(R.id.exam_countdown_container, View.VISIBLE);
                views.setInt(R.id.exam_countdown_bg, "setColorFilter", cdBg);
                views.setTextViewText(R.id.exam_countdown_text, card.countdown);
                views.setTextColor(R.id.exam_countdown_text, cdFg);
            } else {
                views.setViewVisibility(R.id.exam_countdown_container, View.GONE);
            }

            views.setTextViewText(R.id.exam_title, card.title);
            views.setTextColor(R.id.exam_title, t.text);

            views.setTextViewText(R.id.exam_subtitle, card.subtitle);
            views.setTextColor(R.id.exam_subtitle, t.muted);

            views.setTextViewText(R.id.exam_venue, card.venue);
            views.setTextColor(R.id.exam_venue, t.muted);

            int seatBg = card.hasSeat ? WidgetState.blendOver(t.amber, t.surface, 0.18f) : t.surfaceAlt;
            int seatFg = card.hasSeat ? t.amber : t.muted;
            views.setInt(R.id.exam_seat_bg, "setColorFilter", seatBg);
            views.setTextViewText(R.id.exam_seat_text, card.seatOrAction);
            views.setTextColor(R.id.exam_seat_text, seatFg);

            manager.updateAppWidget(widgetId, views);
        }
    }
}
