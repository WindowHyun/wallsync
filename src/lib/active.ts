import { Source } from "../types";
import { SyncResult } from "../wallpaper";

/**
 * 실제 기기 배경 = 마지막으로 적용한 주체 기준.
 * 수동 '지금 적용'(lastApplied)과 백그라운드 자동 갱신 성공(sync 이력) 중 최신을 고른다.
 */
export function resolveActive(
  sources: Source[],
  activeId: string | null,
  syncStatus: Record<string, SyncResult>,
): { src: Source | null; time: number } {
  let src: Source | null = null;
  let time = 0;
  for (const s of sources) {
    const manual = s.id === activeId ? s.lastApplied ?? 0 : 0;
    const auto = s.auto && syncStatus[s.id]?.ok ? syncStatus[s.id].time : 0;
    const t = Math.max(manual, auto);
    if (t > time) { time = t; src = s; }
  }
  return { src, time };
}
