package com.wallsync.app;

import android.app.WallpaperManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import java.io.ByteArrayOutputStream;
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

    /** 다운로드 응답 크기 상한 (메모리 보호). */
    private static final long MAX_DOWNLOAD_BYTES = 64L * 1024 * 1024;

    /** target: "home" | "lock" | "both" */
    public static void setFromUrl(Context ctx, String urlStr, String target) throws IOException {
        byte[] bytes = download(urlStr);

        WallpaperManager wm = WallpaperManager.getInstance(ctx);

        // 희망 배경화면 크기에 맞춰 다운샘플링 (대용량 이미지 OOM 방지)
        int reqW = wm.getDesiredMinimumWidth();
        int reqH = wm.getDesiredMinimumHeight();
        if (reqW <= 0) reqW = 1440;
        if (reqH <= 0) reqH = 3120;

        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);

        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = ScheduleMath.calcInSampleSize(bounds.outWidth, bounds.outHeight, reqW, reqH);

        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
        if (bitmap == null) {
            throw new IOException("이미지를 디코드할 수 없습니다");
        }

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
    }



    /** URL 본문을 바이트 배열로 다운로드 (다운샘플링용 2-pass 디코드를 위해 메모리에 보관). */
    private static byte[] download(String urlStr) throws IOException {
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
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            long total = 0;
            while ((n = in.read(chunk)) != -1) {
                total += n;
                // 비정상적으로 큰 응답은 메모리 보호를 위해 중단 (상한 64MB)
                if (total > MAX_DOWNLOAD_BYTES) {
                    throw new IOException("이미지가 너무 큽니다 (>64MB)");
                }
                buffer.write(chunk, 0, n);
            }
            return buffer.toByteArray();
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
