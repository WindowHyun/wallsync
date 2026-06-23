package com.wallsync.app;

import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "Wallpaper")
public class WallpaperPlugin extends Plugin {

    /** 지금 즉시 URL 이미지를 배경화면으로 적용 */
    @PluginMethod
    public void apply(final PluginCall call) {
        final String url = call.getString("url");
        final String target = call.getString("target", "both");
        if (url == null || url.isEmpty()) {
            call.reject("url 파라미터가 필요합니다");
            return;
        }
        new Thread(() -> {
            try {
                WallpaperHelper.setFromUrl(getContext(), url, target);
                JSObject ret = new JSObject();
                ret.put("ok", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("배경화면 설정 실패: " + e.getMessage());
            }
        }).start();
    }

    /** 자동 갱신 예약 (WorkManager 주기 작업) */
    @PluginMethod
    public void schedule(PluginCall call) {
        String id = call.getString("id");
        String url = call.getString("url");
        String target = call.getString("target", "both");
        Integer minutes = call.getInt("intervalMinutes", 360);
        Integer initialDelaySec = call.getInt("initialDelaySeconds", 0);

        if (id == null || url == null) {
            call.reject("id, url 파라미터가 필요합니다");
            return;
        }
        // WorkManager 주기 작업 최소 간격은 15분
        if (minutes == null || minutes < 15) minutes = 15;
        if (initialDelaySec == null || initialDelaySec < 0) initialDelaySec = 0;

        Data data = new Data.Builder()
                .putString("url", url)
                .putString("target", target)
                .build();

        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                WallpaperWorker.class, minutes, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setInputData(data)
                .setInitialDelay(initialDelaySec, TimeUnit.SECONDS)
                .build();

        WorkManager.getInstance(getContext()).enqueueUniquePeriodicWork(
                "wallsync_" + id,
                ExistingPeriodicWorkPolicy.UPDATE,
                request);

        call.resolve();
    }

    /** 예약 취소 */
    @PluginMethod
    public void cancel(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("id 파라미터가 필요합니다");
            return;
        }
        WorkManager.getInstance(getContext()).cancelUniqueWork("wallsync_" + id);
        call.resolve();
    }
}
