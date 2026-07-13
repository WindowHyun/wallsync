package com.wallsync.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import java.util.regex.Pattern;

/**
 * 매일 깨어나 응원팀의 다가오는 경기를 받아, 시작 lead분 전에 알림이 뜨도록 AlarmManager에 예약한다.
 * 앱이 실행 중이 아니어도 WorkManager가 호출하므로 경기 알림이 끊기지 않고 자동 연장된다.
 *
 * (Capacitor LocalNotifications는 앱이 열려 있을 때만 재예약 가능하므로, 네이티브에서 직접 처리한다.)
 */
public class GameNotifyWorker extends Worker {

    private static final String SCHED_BASE = "https://kbo-wallpaper.vercel.app/api/schedule";
    private static final Pattern TIME_RE = Pattern.compile("^\\d{1,2}:\\d{2}$");
    private static final Pattern SKIP_STATUS = Pattern.compile("취소|연기|중단|노게임|서스펜디드");
    private static final int MAX_GAMES = 30;
    private static final int MAX_ATTEMPTS = 5;

    public GameNotifyWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        String team = getInputData().getString("team");
        int lead = getInputData().getInt("lead", 60);
        if (team == null || team.isEmpty()) return Result.failure();

        Context ctx = getApplicationContext();
        try {
            String body = httpGet(SCHED_BASE + "?team=" + URLEncoder.encode(team, "UTF-8") + "&months=2");
            JSONObject root = new JSONObject(body);
            String shortName = root.optJSONObject("team") != null
                    ? root.getJSONObject("team").optString("short", team) : team;
            JSONArray games = root.optJSONArray("games");
            if (games == null) games = new JSONArray();

            // 매 실행마다 기존 알람을 지우고 최신 일정으로 다시 건다 (드리프트·중복 방지)
            cancelAllAlarms(ctx);

            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.KOREA);
            fmt.setTimeZone(TimeZone.getTimeZone("Asia/Seoul"));
            // JS 명세는 비정상 날짜를 Invalid Date로 걸러낸다 — lenient 롤오버 파싱 차단으로 계약 일치
            fmt.setLenient(false);

            long now = System.currentTimeMillis();
            List<Integer> ids = new ArrayList<>();
            Set<Integer> seen = new HashSet<>();
            int count = Math.min(games.length(), MAX_GAMES);

            for (int i = 0; i < count; i++) {
                JSONObject g = games.getJSONObject(i);
                String status = g.optString("status", "");
                if (!status.isEmpty() && SKIP_STATUS.matcher(status).find()) continue;
                String time = g.optString("time", "");
                if (!TIME_RE.matcher(time).matches()) continue;
                String date = g.optString("date", "");

                String[] hm = time.split(":");
                String padded = (hm[0].length() == 1 ? "0" + hm[0] : hm[0]) + ":" + hm[1];
                Date parsed;
                try { parsed = fmt.parse(date + " " + padded); } catch (Exception e) { continue; }
                if (parsed == null) continue;
                long at = parsed.getTime() - lead * 60000L;
                if (at <= now + 60000) continue;

                int id = GameNotifyConst.notifId(date + time);
                if (seen.contains(id)) continue;
                seen.add(id);

                boolean home = g.optBoolean("home", true);
                String opp = g.optString("opponent", "");
                String stadium = g.optString("stadium", "");
                String title = "⚾ " + shortName + " 경기 " + lead + "분 전";
                String text = (home ? "vs " : "@ ") + opp + " · " + time + (stadium.isEmpty() ? "" : " · " + stadium);

                scheduleAlarm(ctx, am, id, at, title, text);
                ids.add(id);
            }

            saveIds(ctx, ids);
            return Result.success();
        } catch (Exception e) {
            // 네트워크 등 일시 오류 → 재시도. 한도 넘으면 이번 회차 포기(다음 날 주기 실행에서 복구).
            if (getRunAttemptCount() >= MAX_ATTEMPTS - 1) return Result.failure();
            return Result.retry();
        }
    }

    private static void scheduleAlarm(Context ctx, AlarmManager am, int id, long at, String title, String body) {
        if (am == null) return;
        Intent i = new Intent(ctx, GameAlarmReceiver.class);
        i.putExtra("nid", id);
        i.putExtra("title", title);
        i.putExtra("body", body);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, id, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                // 정시 알람 권한이 없으면 오차를 감수하고 근사 예약
                am.setWindow(AlarmManager.RTC_WAKEUP, at, 60000, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (SecurityException se) {
            am.set(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    /** 저장된 id들의 알람을 모두 취소하고 목록을 비운다. */
    static void cancelAllAlarms(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences prefs = ctx.getSharedPreferences(GameNotifyConst.PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(GameNotifyConst.IDS_KEY, "");
        if (am != null && raw != null && !raw.isEmpty()) {
            for (String part : raw.split(",")) {
                try {
                    int id = Integer.parseInt(part.trim());
                    Intent i = new Intent(ctx, GameAlarmReceiver.class);
                    PendingIntent pi = PendingIntent.getBroadcast(ctx, id, i,
                            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
                    if (pi != null) { am.cancel(pi); pi.cancel(); }
                } catch (NumberFormatException ignored) {}
            }
        }
        prefs.edit().remove(GameNotifyConst.IDS_KEY).apply();
    }

    private static void saveIds(Context ctx, List<Integer> ids) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < ids.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(ids.get(i));
        }
        ctx.getSharedPreferences(GameNotifyConst.PREFS, Context.MODE_PRIVATE)
                .edit().putString(GameNotifyConst.IDS_KEY, sb.toString()).apply();
    }

    private static String httpGet(String urlStr) throws Exception {
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
            if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
            in = conn.getInputStream();
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return buf.toString("UTF-8");
        } finally {
            if (in != null) try { in.close(); } catch (Exception ignored) {}
            if (conn != null) conn.disconnect();
        }
    }
}
