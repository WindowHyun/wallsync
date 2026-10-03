package com.wallsync.app;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

/**
 * 경기 알림 워커의 켜기/끄기/재개를 한곳에서 관리한다.
 * 설정(팀·리드타임)은 SharedPreferences에 두어, 앱이 꺼져 있거나 재부팅된 뒤에도
 * (GameBootReceiver) 워커가 같은 설정으로 즉시 알람을 다시 걸 수 있다.
 */
final class GameNotifyScheduler {
    private GameNotifyScheduler() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(GameNotifyConst.PREFS, Context.MODE_PRIVATE);
    }

    static String savedTeam(Context ctx) {
        String t = prefs(ctx).getString(GameNotifyConst.TEAM_KEY, "");
        return t == null ? "" : t;
    }

    static int savedLead(Context ctx) {
        return prefs(ctx).getInt(GameNotifyConst.LEAD_KEY, 60);
    }

    /** 설정을 저장하고 즉시 1회 + 매일 워커를 등록한다. */
    static void enable(Context ctx, String team, int lead) {
        synchronized (GameNotifyConst.LOCK) {
            prefs(ctx).edit()
                    .putString(GameNotifyConst.TEAM_KEY, team)
                    .putInt(GameNotifyConst.LEAD_KEY, lead)
                    .apply();
        }
        WorkManager wm = WorkManager.getInstance(ctx);
        wm.enqueueUniqueWork(GameNotifyConst.UNIQUE_NOW, ExistingWorkPolicy.REPLACE, oneTime());
        wm.enqueueUniquePeriodicWork(GameNotifyConst.UNIQUE_PERIODIC, ExistingPeriodicWorkPolicy.UPDATE,
                new PeriodicWorkRequest.Builder(GameNotifyWorker.class, 1, TimeUnit.DAYS)
                        .setConstraints(network()).build());
    }

    /**
     * 설정을 먼저 지운 뒤 워커·알람을 정리한다. 이미 실행 중인 워커는 락 안에서 설정을 다시 확인하므로
     * 해제 이후에 알람을 걸지 못한다.
     */
    static void disable(Context ctx) {
        synchronized (GameNotifyConst.LOCK) {
            prefs(ctx).edit()
                    .remove(GameNotifyConst.TEAM_KEY)
                    .remove(GameNotifyConst.LEAD_KEY)
                    .apply();
            GameNotifyWorker.cancelAllAlarms(ctx);
        }
        WorkManager wm = WorkManager.getInstance(ctx);
        wm.cancelUniqueWork(GameNotifyConst.UNIQUE_PERIODIC);
        wm.cancelUniqueWork(GameNotifyConst.UNIQUE_NOW);
    }

    /** 알림이 켜져 있으면 즉시 1회 재예약 (재부팅·앱 업데이트 후 소실된 알람 복구용). */
    static void resumeIfEnabled(Context ctx) {
        if (savedTeam(ctx).isEmpty()) return;
        WorkManager.getInstance(ctx)
                .enqueueUniqueWork(GameNotifyConst.UNIQUE_NOW, ExistingWorkPolicy.REPLACE, oneTime());
    }

    private static OneTimeWorkRequest oneTime() {
        return new OneTimeWorkRequest.Builder(GameNotifyWorker.class).setConstraints(network()).build();
    }

    private static Constraints network() {
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }
}
