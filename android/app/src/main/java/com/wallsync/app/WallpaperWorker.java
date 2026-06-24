package com.wallsync.app;

import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
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
 *
 * 실행 결과는 SyncStatusStore에 기록하고, 실패 시 알림을 띄운다(권한/활성화 시).
 */
public class WallpaperWorker extends Worker {

    private static final String CHANNEL_ID = "wallsync_sync";
    private static final int NOTI_BASE_ID = 47000;

    public WallpaperWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        String id = getInputData().getString("id");
        String url = getInputData().getString("url");
        String target = getInputData().getString("target");
        String mode = getInputData().getString("mode");

        if (url == null || url.isEmpty()) {
            SyncStatusStore.record(getApplicationContext(), id, false, System.currentTimeMillis(), "URL 없음");
            return Result.failure();
        }

        try {
            WallpaperHelper.setFromUrl(getApplicationContext(), url, target == null ? "both" : target);
            SyncStatusStore.record(getApplicationContext(), id, true, System.currentTimeMillis(), null);
            // daily 모드는 성공적으로 적용한 뒤 다음 정시를 재예약한다.
            if ("daily".equals(mode)) {
                rescheduleDaily();
            }
            return Result.success();
        } catch (Exception e) {
            String msg = e.getMessage() == null ? "알 수 없는 오류" : e.getMessage();
            SyncStatusStore.record(getApplicationContext(), id, false, System.currentTimeMillis(), msg);
            notifyFailure(id, msg);
            // 네트워크 일시 오류 등 → 다음 기회에 재시도.
            // (daily는 retry 시 재예약하지 않고, WorkManager 백오프로 같은 작업을 다시 시도)
            return Result.retry();
        }
    }

    /** 다음 dailyHour:dailyMinute 까지 남은 초 (현재 시각이 이미 지났으면 다음 날). */
    public static long secondsUntilNextDaily(int hour, int minute) {
        return ScheduleMath.secondsUntilNextDaily(Calendar.getInstance(), hour, minute);
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
                .putString("id", getInputData().getString("id"))
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

    /** 실패 알림 (알림 권한/활성화 시에만, 안전하게). */
    @SuppressLint("MissingPermission")
    private void notifyFailure(String id, String reason) {
        Context ctx = getApplicationContext();
        try {
            NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
            if (!nm.areNotificationsEnabled()) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager sys = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                if (sys != null && sys.getNotificationChannel(CHANNEL_ID) == null) {
                    sys.createNotificationChannel(new NotificationChannel(
                            CHANNEL_ID, "자동 갱신 알림", NotificationManager.IMPORTANCE_LOW));
                }
            }

            NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.stat_notify_error)
                    .setContentTitle("배경화면 자동 갱신 실패")
                    .setContentText(reason)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_LOW);

            int notiId = NOTI_BASE_ID + (id == null ? 0 : Math.abs(id.hashCode()) % 1000);
            nm.notify(notiId, b.build());
        } catch (Exception ignored) {
            // 권한 미부여(SecurityException) 등 → 상태는 이미 기록되었으므로 무시
        }
    }
}
