import { Schedule } from "../types";
import { WallpaperTarget, SyncResult } from "../wallpaper";
import { C } from "../theme";

export function rel(ts: number) {
  const d = Date.now() - ts;
  if (d < 60000) return "방금 전";
  if (d < 3600000) return `${Math.floor(d / 60000)}분 전`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}시간 전`;
  return `${Math.floor(d / 86400000)}일 전`;
}

export const appliedLabel = (ts: number | null) => (ts ? `${rel(ts)} 적용` : "미적용");

export const targetLabel = (t: WallpaperTarget) => (t === "home" ? "홈" : t === "lock" ? "잠금" : "홈+잠금");

export function scheduleLabel(s: Schedule | null) {
  if (!s) return "";
  if (s.kind === "interval") return `${s.hours}시간마다`;
  return `매일 ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
}

export const leadLabel = (m: number) =>
  m < 60 ? `${m}분` : m % 60 === 0 ? `${m / 60}시간` : `${Math.floor(m / 60)}시간 ${m % 60}분`;

// 자동 갱신 마지막 결과 라벨
export function syncLabel(r: SyncResult | undefined): { text: string; color: string } | null {
  if (!r) return null;
  if (r.ok) return { text: `자동 갱신 ✓ ${rel(r.time)}`, color: C.success };
  return { text: "자동 갱신 ✗ 실패", color: C.error };
}
