package com.wallsync.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(
        name = "Wallpaper",
        permissions = {
                @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
        }
)
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

    /**
     * 자동 갱신 예약.
     * - mode="interval" : N분마다 반복 (PeriodicWorkRequest, 최소 15분)
     * - mode="daily"    : 매일 dailyHour:dailyMinute 정시. OneTimeWork가 매 실행마다
     *                     다음 정시를 재예약하므로 시각이 드리프트되지 않는다.
     */
    @PluginMethod
    public void schedule(PluginCall call) {
        String id = call.getString("id");
        String url = call.getString("url");
        String target = call.getString("target", "both");
        String mode = call.getString("mode", "interval");

        if (id == null || url == null) {
            call.reject("id, url 파라미터가 필요합니다");
            return;
        }

        String workName = "wallsync_" + id;
        WorkManager wm = WorkManager.getInstance(getContext());
        // 모드 전환(daily↔interval) 시 이전 작업 유형이 달라 unique 정책만으로는
        // 깨끗이 교체되지 않을 수 있으므로, 재등록 전 항상 기존 작업을 취소한다.
        wm.cancelUniqueWork(workName);

        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        if ("daily".equals(mode)) {
            Integer hour = call.getInt("dailyHour", 8);
            Integer minute = call.getInt("dailyMinute", 0);
            if (hour == null || hour < 0 || hour > 23) hour = 8;
            if (minute == null || minute < 0 || minute > 59) minute = 0;

            long delaySec = WallpaperWorker.secondsUntilNextDaily(hour, minute);

            Data data = new Data.Builder()
                    .putString("id", id)
                    .putString("url", url)
                    .putString("target", target)
                    .putString("mode", "daily")
                    .putString("workName", workName)
                    .putInt("dailyHour", hour)
                    .putInt("dailyMinute", minute)
                    .build();

            OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(WallpaperWorker.class)
                    .setConstraints(constraints)
                    .setInputData(data)
                    .setInitialDelay(delaySec, TimeUnit.SECONDS)
                    .build();

            // 설정을 바꿔 다시 저장하면 기존 체인을 교체
            wm.enqueueUniqueWork(
                    workName,
                    ExistingWorkPolicy.REPLACE,
                    request);
        } else {
            Integer minutes = call.getInt("intervalMinutes", 360);
            // WorkManager 주기 작업 최소 간격은 15분
            if (minutes == null || minutes < 15) minutes = 15;

            Data data = new Data.Builder()
                    .putString("id", id)
                    .putString("url", url)
                    .putString("target", target)
                    .putString("mode", "interval")
                    .build();

            PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                    WallpaperWorker.class, minutes, TimeUnit.MINUTES)
                    .setConstraints(constraints)
                    .setInputData(data)
                    .build();

            wm.enqueueUniquePeriodicWork(
                    workName,
                    ExistingPeriodicWorkPolicy.UPDATE,
                    request);
        }

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

    /** 각 소스의 마지막 자동 갱신 결과 조회 (워커가 SharedPreferences에 기록) */
    @PluginMethod
    public void getSyncStatus(PluginCall call) {
        Map<String, ?> all = SyncStatusStore.all(getContext());
        JSArray results = new JSArray();
        for (Map.Entry<String, ?> e : all.entrySet()) {
            Object v = e.getValue();
            if (!(v instanceof String)) continue;
            try {
                JSObject o = new JSObject((String) v);
                o.put("id", e.getKey());
                results.put(o);
            } catch (JSONException ignored) {}
        }
        JSObject ret = new JSObject();
        ret.put("results", results);
        call.resolve(ret);
    }

    /** 알림 권한 요청 (Android 13+) */
    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("notifications", call, "notifPermCallback");
    }

    @PermissionCallback
    private void notifPermCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(ret);
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
