package com.kailash.vtopia;

import android.content.Intent;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static final String EXTRA_WIDGET_TARGET = "vtopia_target";
    private String pendingLaunchTarget = null;
    private OnBackPressedCallback backCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(VtopiaWidgetPlugin.class);
        captureTarget(getIntent(), false);
        super.onCreate(savedInstanceState);
        VtopiaWidgetPlugin.refreshWidgets(this);

        backCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge == null || bridge.getWebView() == null) {
                    exitFromBack();
                    return;
                }
                bridge.eval(
                    "(function(){try{return typeof window.__vtopiaHandleBack==='function'?Boolean(window.__vtopiaHandleBack()):false;}catch(e){return false;}})()",
                    result -> {
                        if (isFinishing() || isDestroyed()) {
                            return;
                        }
                        if (!"true".equals(result)) {
                            exitFromBack();
                        }
                    }
                );
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backCallback);
    }

    private void exitFromBack() {
        if (backCallback != null) {
            backCallback.setEnabled(false);
        }
        try {
            getOnBackPressedDispatcher().onBackPressed();
        } finally {
            if (backCallback != null && !isFinishing() && !isDestroyed()) {
                backCallback.setEnabled(true);
            }
        }
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
