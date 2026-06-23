package com.wallsync.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;

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

    /** 현재 앱이 배터리 최적화 예외인지 확인 */
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        boolean ignoring = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        JSObject ret = new JSObject();
        ret.put("ignoring", ignoring);
        call.resolve(ret);
    }

    /** 배터리 최적화 해제 시스템 팝업 띄우기 (앱 지정) */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            // 일부 기기/정책에서 차단된 경우 → 앱 상세 설정으로 우회
            openAppDetails(call);
        }
    }

    /** 배터리 최적화 목록 설정 화면 열기 (수동 선택용) */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            openAppDetails(call);
        }
    }

    /** 앱 상세 설정(권한·배터리) 화면 열기 — 폴백 */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        openAppDetails(call);
    }

    private void openAppDetails(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("설정 화면을 열 수 없습니다: " + e.getMessage());
        }
    }
}
