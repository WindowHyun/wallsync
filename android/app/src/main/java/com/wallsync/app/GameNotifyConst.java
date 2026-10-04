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

    /** 알림 설정(팀·리드타임) — 켜져 있는 동안만 존재. 워커·부팅 복구가 참조하는 단일 진실 원천. */
    static final String TEAM_KEY = "team";
    static final String LEAD_KEY = "lead";
    /** 이전 버전(WorkRequest 입력에만 설정을 저장)의 설정을 옮겼거나, 더 이상 옮길 필요가 없음을 표시. */
    static final String MIGRATED_KEY = "legacy_input_migrated";

    /** 워커의 예약 구간과 해제(cancel)가 서로 끼어들지 않게 하는 락. */
    static final Object LOCK = new Object();

    static final String UNIQUE_PERIODIC = "wallsync_gamenotify";
    static final String UNIQUE_NOW = "wallsync_gamenotify_now";

    /** 문자열 → 결정적 알림 id (100000~999999). TS notifId(src/lib/schedule-plan.ts)와 동일 결과여야 한다. */
    static int notifId(String s) {
        int h = 0;
        for (int i = 0; i < s.length(); i++) h = h * 31 + s.charAt(i);
        return 100000 + ((h & 0x7fffffff) % 900000);
    }
}
