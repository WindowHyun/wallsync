import { SchedResponse } from "./schedule-plan";

// 일정 응답 캐시 — 같은 팀·같은 날에는 재요청하지 않는다 (비공식 API 호출 절감)
const CACHE_KEY = "wallsync.sched.cache.v1";

interface CacheEntry { team: string; day: string; data: SchedResponse }

/** ms 타임스탬프 → 로컬 날짜 문자열(YYYY-MM-DD) */
export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 같은 팀·같은 날 캐시가 있으면 반환, 없으면 null. */
export function readSchedCache(team: string, now: number): SchedResponse | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const e = JSON.parse(raw) as CacheEntry;
    if (e.team === team && e.day === dayKey(now) && e.data) return e.data;
  } catch { /* ignore */ }
  return null;
}

export function writeSchedCache(team: string, now: number, data: SchedResponse): void {
  try {
    const e: CacheEntry = { team, day: dayKey(now), data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(e));
  } catch { /* ignore */ }
}
