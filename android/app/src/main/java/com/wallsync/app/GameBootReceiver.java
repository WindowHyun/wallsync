package com.wallsync.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * 재부팅·앱 업데이트 후 AlarmManager 알람이 사라지므로, 경기 알림이 켜져 있으면 즉시 다시 예약한다.
 * (일일 워커만으로는 다음 주기까지 최대 24시간 알림이 끊긴다.)
 */
public class GameBootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            GameNotifyScheduler.resumeIfEnabled(ctx);
        }
    }
}
