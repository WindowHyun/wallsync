import { registerPlugin } from "@capacitor/core";

export type WallpaperTarget = "home" | "lock" | "both";

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
