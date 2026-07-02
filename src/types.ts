import { WallpaperTarget } from "./wallpaper";

// ─── 도메인 타입 (웹 전역 공유) ────────────────────────────────────────────────────

export type Schedule =
  | { kind: "interval"; hours: number }
  | { kind: "daily"; hour: number; minute: number };

export interface KboConfig { team: string; style: string; mode: string; res: string }

export interface Source {
  id: string;
  name: string;
  type: "url" | "kbo";
  url: string;
  target: WallpaperTarget;
  kbo?: KboConfig;
  auto: boolean;
  schedule: Schedule | null;
  addedAt: number;
  lastApplied: number | null;
}

export interface NotifSettings { enabled: boolean; team: string; lead: number }

/** v2 백업에서 소스 외에 함께 복원되는 항목 */
export interface BackupExtra { notif?: NotifSettings; activeId?: string | null }

export interface ToastAction { label: string; fn: () => void }
export interface ToastMsg { id: string; msg: string; type: "success" | "error" | "warn"; action?: ToastAction }
