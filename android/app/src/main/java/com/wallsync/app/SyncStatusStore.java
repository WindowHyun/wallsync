package com.wallsync.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.util.Map;

/**
 * 자동 갱신 실행 결과를 소스 id별로 SharedPreferences에 저장한다.
 * (권한 불필요 — UI가 getSyncStatus로 읽어 마지막 성공/실패를 표시)
 */
final class SyncStatusStore {

    private static final String PREFS = "wallsync_sync_status";

    private SyncStatusStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** id별 마지막 결과를 JSON 문자열로 기록. */
    static void record(Context ctx, String id, boolean ok, long time, String error) {
        if (id == null) return;
        try {
            JSONObject o = new JSONObject();
            o.put("ok", ok);
            o.put("time", time);
            if (error != null) o.put("error", error);
            prefs(ctx).edit().putString(id, o.toString()).apply();
        } catch (Exception ignored) {}
    }

    static Map<String, ?> all(Context ctx) {
        return prefs(ctx).getAll();
    }
}
