package com.kailash.vtopia;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static final String EXTRA_WIDGET_TARGET = "vtopia_target";
    private String pendingLaunchTarget = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(VtopiaWidgetPlugin.class);
        captureTarget(getIntent(), false);
        super.onCreate(savedInstanceState);
        VtopiaWidgetPlugin.refreshWidgets(this);
    }

    @Override
    public void onResume() {
        super.onResume();
        VtopiaWidgetPlugin.refreshWidgets(this);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null) {
            setIntent(intent);
            captureTarget(intent, true);
        }
    }

    private void captureTarget(Intent intent, boolean notifyIfLoaded) {
        if (intent == null) return;
        String target = intent.getStringExtra(EXTRA_WIDGET_TARGET);
        if (target == null || target.isEmpty()) return;
        intent.removeExtra(EXTRA_WIDGET_TARGET);
        if (notifyIfLoaded && VtopiaWidgetPlugin.emitNavigate(target)) {
            pendingLaunchTarget = null;
        } else {
            pendingLaunchTarget = target;
        }
    }

    public String consumePendingTarget() {
        String out = pendingLaunchTarget;
        pendingLaunchTarget = null;
        return out;
    }
}
