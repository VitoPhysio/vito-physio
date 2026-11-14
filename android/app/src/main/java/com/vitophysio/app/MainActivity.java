package com.vitophysio.app;

import com.getcapacitor.BridgeActivity;
import android.app.NotificationManager;
import android.content.Intent;

public class MainActivity extends BridgeActivity {
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent == null || !intent.hasExtra("vito_action")) return;
        String tag = intent.getStringExtra("tag");
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (tag != null && manager != null) manager.cancel(tag, tag.hashCode());
    }
}
