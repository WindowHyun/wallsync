package com.wallsync.app;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.Calendar;
import java.util.concurrent.TimeUnit;

/**
 * 예약된 시각/주기마다 깨어나 URL 이미지를 다시 받아 배경화면을 갱신한다.
 * 앱이 실행 중이 아니어도 WorkManager가 호출한다.
 *
 * - interval 모드: PeriodicWorkRequest가 주기적으로 호출한다.
 * - daily 모드: OneTimeWork로 동작하며, 실행할 때마다 다음 정시를 스스로 재예약한다
 *   (PeriodicWork의 initialDelay가 첫 실행에만 적용되어 시각이 드리프트되는 문제 회피).
 */
public class WallpaperWorker extends Worker {

    public WallpaperWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        String url = getInputData().getString("url");
        String target = getInputData().getString("target");
        String mode = getInputData().getString("mode");

        if (url == null || url.isEmpty()) {
            return Result.failure();
        }

        try {
            WallpaperHelper.setFromUrl(getApplicationContext(), url, target == null ? "both" : target);
            // daily 모드는 성공적으로 적용한 뒤 다음 정시를 재예약한다.
            if ("daily".equals(mode)) {
                rescheduleDaily();
            }
            return Result.success();
        } catch (Exception e) {
            // 네트워크 일시 오류 등 → 다음 기회에 재시도.
            // (daily는 retry 시 재예약하지 않고, WorkManager 백오프로 같은 작업을 다시 시도)
            return Result.retry();
        }
    }

    /** 다음 dailyHour:dailyMinute 까지 남은 초 (현재 시각이 이미 지났으면 다음 날). */
    public static long secondsUntilNextDaily(int hour, int minute) {
        Calendar now = Calendar.getInstance();
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, hour);
        next.set(Calendar.MINUTE, minute);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (!next.after(now)) {
            next.add(Calendar.DAY_OF_MONTH, 1);
        }
        long diffMs = next.getTimeInMillis() - now.getTimeInMillis();
        return Math.max(0, diffMs / 1000);
    }

    /** 같은 입력으로 다음 날 같은 시각에 다시 실행되도록 OneTimeWork를 재등록. */
    private void rescheduleDaily() {
        int hour = getInputData().getInt("dailyHour", 8);
        int minute = getInputData().getInt("dailyMinute", 0);
        String workName = getInputData().getString("workName");
        if (workName == null) return;

        long delaySec = secondsUntilNextDaily(hour, minute);

        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        Data data = new Data.Builder()
                .putString("url", getInputData().getString("url"))
                .putString("target", getInputData().getString("target"))
                .putString("mode", "daily")
                .putString("workName", workName)
                .putInt("dailyHour", hour)
                .putInt("dailyMinute", minute)
                .build();

        OneTimeWorkRequest next = new OneTimeWorkRequest.Builder(WallpaperWorker.class)
                .setConstraints(constraints)
                .setInputData(data)
                .setInitialDelay(delaySec, TimeUnit.SECONDS)
                .build();

        WorkManager.getInstance(getApplicationContext()).enqueueUniqueWork(
                workName,
                ExistingWorkPolicy.REPLACE,
                next);
    }
}
