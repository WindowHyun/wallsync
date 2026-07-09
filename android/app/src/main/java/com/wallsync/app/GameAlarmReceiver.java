package com.wallsync.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * AlarmManager가 예약 시각에 깨워주면 실제 경기 알림을 표시한다.
 * (앱이 꺼져 있어도 시스템이 이 리시버를 호출한다.)
 */
public class GameAlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent intent) {
        int nid = intent.getIntExtra("nid", 1);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        if (title == null) title = "⚾ 경기 알림";
        if (body == null) body = "";

        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        if (!nm.areNotificationsEnabled()) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager sys = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (sys != null && sys.getNotificationChannel(GameNotifyConst.CHANNEL_ID) == null) {
                sys.createNotificationChannel(new NotificationChannel(
                        GameNotifyConst.CHANNEL_ID, GameNotifyConst.CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH));
            }
        }

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, GameNotifyConst.CHANNEL_ID)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH);

        try {
            nm.notify(nid, b.build());
        } catch (SecurityException ignored) {
            // 알림 권한 미부여 등 → 무시
        }
    }
}
