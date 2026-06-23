package com.wallsync.app;

import android.app.WallpaperManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * URL 이미지를 내려받아 안드로이드 배경화면으로 설정하는 공용 로직.
 * 플러그인(즉시 적용)과 WorkManager 워커(자동 갱신)가 함께 사용한다.
 */
public final class WallpaperHelper {

    private WallpaperHelper() {}

    /** target: "home" | "lock" | "both" */
    public static void setFromUrl(Context ctx, String urlStr, String target) throws IOException {
        HttpURLConnection conn = null;
        InputStream in = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "WallSync-Android");
            conn.connect();

            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                throw new IOException("HTTP " + code);
            }

            in = conn.getInputStream();
            Bitmap bitmap = BitmapFactory.decodeStream(in);
            if (bitmap == null) {
                throw new IOException("이미지를 디코드할 수 없습니다");
            }

            WallpaperManager wm = WallpaperManager.getInstance(ctx);
            int which;
            if ("home".equals(target)) {
                which = WallpaperManager.FLAG_SYSTEM;
            } else if ("lock".equals(target)) {
                which = WallpaperManager.FLAG_LOCK;
            } else {
                which = WallpaperManager.FLAG_SYSTEM | WallpaperManager.FLAG_LOCK;
            }
            // API 24+ : 홈/잠금 화면 개별 지정 가능 (minSdk 24)
            wm.setBitmap(bitmap, null, true, which);
        } finally {
            if (in != null) {
                try { in.close(); } catch (IOException ignored) {}
            }
            if (conn != null) {
                conn.disconnect();
            }
        }
    }
}
