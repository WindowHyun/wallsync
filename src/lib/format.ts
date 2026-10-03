import { Schedule, Source } from "../types";
import { TEAMS, STYLES, MODES } from "./kbo";
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

// 자동 갱신 마지막 결과 라벨 (실패만 강조색, 성공은 차분하게)
export function syncLabel(r: SyncResult | undefined): { text: string; color: string; ok: boolean } | null {
  if (!r) return null;
  if (r.ok) return { text: `${rel(r.time)} 갱신됨 · 성공`, color: C.muted, ok: true };
  return { text: `자동 갱신 실패${r.error ? ` · ${r.error}` : ""}`, color: C.error, ok: false };
}

/** 카드 부제: KBO는 "KBO · 두산 베어스 · 미니멀 · 다크", URL은 "URL · host/path" */
export function metaLabel(s: Source): string {
  if (s.type === "kbo" && s.kbo) {
    const label = (list: string[][], v: string) => list.find((x) => x[0] === v)?.[1] ?? v;
    return ["KBO", label(TEAMS, s.kbo.team), label(STYLES, s.kbo.style), label(MODES, s.kbo.mode)].join(" · ");
  }
  try {
    const u = new URL(s.url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `URL · ${u.host}${path}`;
  } catch {
    return `URL · ${s.url}`;
  }
}
