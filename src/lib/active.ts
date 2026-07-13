import { Source, ActiveMap } from "../types";
import { SyncResult, WallpaperTarget } from "../wallpaper";

// ─── 화면(홈/잠금)별 "현재 적용 중" 계산 ─────────────────────────────────────────────
// 홈에 A, 잠금에 B를 적용하는 사용 방식을 지원하기 위해 화면별로 따로 추적한다.
// 각 화면의 실제 배경 = 그 화면을 덮은 마지막 적용 주체:
// 수동 '지금 적용'(ActiveMap + lastApplied)과 자동 갱신 성공(sync 이력) 중 최신.

export interface ScreenActive { src: Source | null; time: number }
export interface ActiveScreens { home: ScreenActive; lock: ScreenActive }

const covers = (target: WallpaperTarget, screen: "home" | "lock") =>
  target === "both" || target === screen;

export function resolveActiveScreens(
  sources: Source[],
  active: ActiveMap,
  syncStatus: Record<string, SyncResult>,
): ActiveScreens {
  const calc = (screen: "home" | "lock"): ScreenActive => {
    let src: Source | null = null;
    let time = 0;
    for (const s of sources) {
      const manual = active[screen] === s.id ? s.lastApplied ?? 0 : 0;
      const auto = covers(s.target, screen) && s.auto && syncStatus[s.id]?.ok ? syncStatus[s.id].time : 0;
      const t = Math.max(manual, auto);
      if (t > time) { time = t; src = s; }
    }
    return { src, time };
  };
  return { home: calc("home"), lock: calc("lock") };
}

/** 수동 적용 직후 — target이 덮는 화면에 id를 기록한다. */
export function markActive(m: ActiveMap, id: string, target: WallpaperTarget): ActiveMap {
  return {
    home: target !== "lock" ? id : m.home,
    lock: target !== "home" ? id : m.lock,
  };
}

/** 소스 삭제·URL 변경 시 — 해당 id가 기록된 화면을 비운다. */
export function clearActiveId(m: ActiveMap, id: string): ActiveMap {
  return {
    home: m.home === id ? null : m.home,
    lock: m.lock === id ? null : m.lock,
  };
}

/** 구버전 단일 activeId(v1 저장소·v2 백업) → 소스의 target 기준으로 화면별 매핑. */
export function activeFromLegacy(sources: Source[], legacyId: string | null | undefined): ActiveMap {
  const s = legacyId ? sources.find((x) => x.id === legacyId) : undefined;
  if (!s) return { home: null, lock: null };
  return markActive({ home: null, lock: null }, s.id, s.target);
}
