import { registerPlugin } from "@capacitor/core";

export type WallpaperTarget = "home" | "lock" | "both";

/** 백그라운드 자동 갱신 1회 실행 결과 */
export interface SyncResult {
  id: string;
  ok: boolean;
  time: number;
  error?: string;
}

export interface WallpaperPlugin {
  /** URL 이미지를 지금 즉시 배경화면으로 적용 */
  apply(options: { url: string; target: WallpaperTarget }): Promise<{ ok: boolean }>;
  /** 자동 갱신 예약 (백그라운드 WorkManager) */
  schedule(options: {
    id: string;
    url: string;
    target: WallpaperTarget;
    /** "interval": N분마다 반복 / "daily": 매일 dailyHour:dailyMinute 정시 */
    mode: "interval" | "daily";
    /** interval 모드 전용 — 반복 주기(분, 최소 15) */
    intervalMinutes?: number;
    /** daily 모드 전용 — 매일 적용 시각 (0~23) */
    dailyHour?: number;
    /** daily 모드 전용 — 매일 적용 분 (0~59) */
    dailyMinute?: number;
  }): Promise<void>;
  /** 예약 취소 */
  cancel(options: { id: string }): Promise<void>;
  /** 각 소스의 마지막 자동 갱신 결과 조회 */
  getSyncStatus(): Promise<{ results: SyncResult[] }>;
  /** 알림 권한 요청 (Android 13+). 그 이하 버전은 항상 granted */
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  /** Android 12+ 정시(exact) 알람 허용 여부 — 경기 알림 정시 발화에 필요 */
  canScheduleExactAlarms(): Promise<{ allowed: boolean }>;
  /** '알람 및 리마인더' 특별 접근 설정 화면 열기 (Android 12+) */
  openExactAlarmSettings(): Promise<void>;
  /** 배터리 최적화 예외 여부 확인 */
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  /** 배터리 최적화 해제 시스템 팝업 */
  requestIgnoreBatteryOptimizations(): Promise<void>;
  /** 배터리 최적화 목록 설정 화면 */
  openBatterySettings(): Promise<void>;
  /** 앱 상세 설정 화면 (폴백) */
  openAppSettings(): Promise<void>;
}

export const Wallpaper = registerPlugin<WallpaperPlugin>("Wallpaper");
