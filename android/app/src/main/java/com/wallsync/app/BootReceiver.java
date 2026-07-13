package com.wallsync.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

/**
 * 재부팅 직후 경기 알람을 복구한다.
 *
 * AlarmManager 알람은 재부팅 시 시스템이 모두 삭제한다. 매일 주기 워커(GameNotifyWorker)가
 * 하루 안에 다시 예약하긴 하지만, 그 사이에 시작하는 경기는 알림이 누락된다.
 * 부팅을 감지하면 저장된 설정(팀·lead)으로 일정 워커를 즉시 1회 실행해 공백을 없앤다.
 * (배경화면 자동 갱신은 WorkManager가 재부팅 후에도 스스로 복구하므로 여기서 다루지 않는다.)
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;

        SharedPreferences prefs = ctx.getSharedPreferences(GameNotifyConst.PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(GameNotifyConst.CFG_ENABLED, false)) return;
        String team = prefs.getString(GameNotifyConst.CFG_TEAM, null);
        if (team == null || team.isEmpty()) return;
        int lead = prefs.getInt(GameNotifyConst.CFG_LEAD, 60);

        Data data = new Data.Builder()
                .putString("team", team)
                .putInt("lead", lead)
                .build();
        Constraints net = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        OneTimeWorkRequest now = new OneTimeWorkRequest.Builder(GameNotifyWorker.class)
                .setInputData(data)
                .setConstraints(net)
                .build();
        WorkManager.getInstance(ctx)
                .enqueueUniqueWork(GameNotifyConst.UNIQUE_NOW, ExistingWorkPolicy.REPLACE, now);
    }
}
