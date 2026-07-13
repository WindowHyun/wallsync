package com.wallsync.app;

/** 경기 알림 파이프라인이 공유하는 상수. */
final class GameNotifyConst {
    private GameNotifyConst() {}

    /** 경기 알림 채널 (Worker·Receiver 공용). */
    static final String CHANNEL_ID = "wallsync_games";
    static final String CHANNEL_NAME = "경기 알림";

    /** 예약된 알람 id 저장 (취소용). */
    static final String PREFS = "wallsync_game_alarms";
    static final String IDS_KEY = "alarm_ids";

    /** 알림 설정 (재부팅 직후 BootReceiver가 읽어 즉시 재예약하기 위해 네이티브에도 보관). */
    static final String CFG_ENABLED = "cfg_enabled";
    static final String CFG_TEAM = "cfg_team";
    static final String CFG_LEAD = "cfg_lead";

    static final String UNIQUE_PERIODIC = "wallsync_gamenotify";
    static final String UNIQUE_NOW = "wallsync_gamenotify_now";

    /**
     * 문자열 → 결정적 알림 id (100000~999999).
     * JS 명세(lib/schedule-plan.ts notifId)와 반드시 같은 값이어야 한다 —
     * JS의 `>>> 0`(unsigned 32bit)과 일치하도록 부호 없는 해석 후 나머지 연산.
     * (Math.abs(signed)는 해시가 2^31 이상인 입력에서 다른 값을 만든다)
     */
    static int notifId(String s) {
        int h = 0;
        for (int i = 0; i < s.length(); i++) h = h * 31 + s.charAt(i);
        return 100000 + (int) ((h & 0xffffffffL) % 900000L);
    }
}
