import { Source, NotifSettings, ActiveMap } from "./types";
import { sanitizeSources } from "./lib/sanitize";

// ─── 로컬 저장 레이어 — 키와 접근을 한 곳에서 관리 ─────────────────────────────────────
const STORE_KEY = "wallsync.sources.v1";
const ACTIVE_KEY_LEGACY = "wallsync.active.v1"; // 단일 activeId (구버전)
const ACTIVE_KEY = "wallsync.active.v2";        // 화면(홈/잠금)별 activeId
const NOTIF_KEY = "wallsync.notif.v1";

export function loadSources(): Source[] {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return [];
  try {
    const sources = sanitizeSources(JSON.parse(raw));
    if (sources === null) throw new Error("not an array");
    return sources;
  } catch {
    // 손상 데이터를 조용히 버리지 않고 복구용으로 보존해둔다
    try { localStorage.setItem(STORE_KEY + ".corrupt", raw); } catch { /* ignore */ }
    return [];
  }
}
export function saveSources(sources: Source[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(sources));
}

/** v2(화면별) 적용중 상태. 저장된 적 없으면 null — 호출부에서 legacy 마이그레이션 판단. */
export function loadActiveMap(): ActiveMap | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return {
      home: typeof p?.home === "string" ? p.home : null,
      lock: typeof p?.lock === "string" ? p.lock : null,
    };
  } catch { return null; }
}
export function saveActiveMap(m: ActiveMap) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(m));
}

/** 구버전 단일 activeId — v2 마이그레이션 후 제거된다. */
export function loadLegacyActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY_LEGACY);
}
export function clearLegacyActiveId() {
  localStorage.removeItem(ACTIVE_KEY_LEGACY);
}

/** 저장된 적 없으면 null — 호출부에서 기본값(팀 추론 등)을 결정한다. */
export function loadNotif(): NotifSettings | null {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function saveNotifSettings(n: NotifSettings) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(n));
}
