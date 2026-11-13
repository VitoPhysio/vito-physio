package com.vitophysio.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.BitmapFactory;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/** Data-only action-capable alerts are rendered locally, including when the app is closed. */
public class VitoMessagingService extends MessagingService {
    private PendingIntent destination(Map<String, String> data, String messageId, String action, int id) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        for (Map.Entry<String, String> entry : data.entrySet()) intent.putExtra(entry.getKey(), entry.getValue());
        intent.putExtra("google.message_id", messageId);
        intent.putExtra("vito_action", action);
        return PendingIntent.getActivity(this, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        if (!"1".equals(data.get("vito_actions"))) { super.onMessageReceived(message); return; }
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel("vito-default", "Messages & activity", NotificationManager.IMPORTANCE_HIGH);
            channel.enableVibration(true);
            manager.createNotificationChannel(channel);
        }
        String tag = data.getOrDefault("tag", "vito");
        String messageId = message.getMessageId() == null ? tag : message.getMessageId();
        int id = tag.hashCode();
        String body = data.getOrDefault("body", "New activity");
        NotificationCompat.Builder alert = new NotificationCompat.Builder(this, "vito-default")
            .setSmallIcon(R.drawable.ic_notification_v)
            .setLargeIcon(BitmapFactory.decodeResource(getResources(), R.drawable.vito_logo))
            .setContentTitle(data.getOrDefault("title", "VITO Physio"))
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .setContentIntent(destination(data, messageId, "open", id));
        String path = data.getOrDefault("path", "");
        if (path.startsWith("/messages?conversation=")) {
            alert.addAction(R.drawable.ic_notification_v, "Reply", destination(data, messageId, "reply", id + 1));
            alert.addAction(R.drawable.ic_notification_v, "Mark as read", destination(data, messageId, "read", id + 2));
        } else {
            alert.addAction(R.drawable.ic_notification_v, "Open", destination(data, messageId, "open", id + 3));
        }
        manager.notify(tag, id, alert.build());
    }
}