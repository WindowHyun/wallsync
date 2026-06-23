package com.wallsync.app;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * 예약된 시각/주기마다 깨어나 URL 이미지를 다시 받아 배경화면을 갱신한다.
 * 앱이 실행 중이 아니어도 WorkManager가 호출한다.
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
        if (url == null || url.isEmpty()) {
            return Result.failure();
        }
        try {
            WallpaperHelper.setFromUrl(getApplicationContext(), url, target == null ? "both" : target);
            return Result.success();
        } catch (Exception e) {
            // 네트워크 일시 오류 등 → 다음 기회에 재시도
            return Result.retry();
        }
    }
}
