package com.kailash.vtopia;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;

@CapacitorPlugin(name = "VtopiaWidget")
public class VtopiaWidgetPlugin extends Plugin {
    private static WeakReference<VtopiaWidgetPlugin> activeInstance = new WeakReference<>(null);

    @Override
    public void load() {
        super.load();
        activeInstance = new WeakReference<>(this);
    }

    @PluginMethod
    public void updateSnapshot(PluginCall call) {
        String snapshot = call.getString("snapshot", "");
        Context context = getContext();
        WidgetState.saveSnapshot(context, snapshot);
        refreshWidgets(context);
        call.resolve();
    }

    @PluginMethod
    public void getLaunchTarget(PluginCall call) {
        JSObject ret = new JSObject();
        if (getActivity() instanceof MainActivity) {
            String target = ((MainActivity) getActivity()).consumePendingTarget();
            ret.put("target", target);
        } else {
            ret.put("target", (String) null);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void pinWidget(PluginCall call) {
        String kind = call.getString("kind", "class");
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            ret.put("supported", false);
            ret.put("requested", false);
            call.resolve(ret);
            return;
        }
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null || !manager.isRequestPinAppWidgetSupported()) {
            ret.put("supported", false);
            ret.put("requested", false);
            call.resolve(ret);
            return;
        }
        Class<?> cls = "exam".equals(kind) ? ExamWidgetProvider.class : ClassWidgetProvider.class;
        boolean requested = manager.requestPinAppWidget(new ComponentName(context, cls), null, null);
        ret.put("supported", true);
        ret.put("requested", requested);
        call.resolve(ret);
    }

    @PluginMethod
    public void getAppVersion(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();
        try {
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            ret.put("versionCode", PackageInfoCompat.getLongVersionCode(info));
            ret.put("versionName", info.versionName != null ? info.versionName : "");
        } catch (Exception e) {
            ret.put("versionCode", 0);
            ret.put("versionName", "");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openExternalUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || !url.startsWith("https://")) {
            call.reject("Only HTTPS URLs are supported.");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open link.");
        }
    }

    public static void refreshWidgets(Context context) {
        if (context == null) return;
        WidgetScheduler.refreshAll(context);
    }

    public static boolean emitNavigate(String target) {
        VtopiaWidgetPlugin plugin = activeInstance.get();
        if (plugin == null || target == null || target.isEmpty()) return false;
        JSObject payload = new JSObject();
        payload.put("target", target);
        plugin.notifyListeners("widgetNavigate", payload);
        return true;
    }
}
