import { Source, NotifSettings } from "./types";
import { sanitizeSources } from "./lib/sanitize";

// ─── 로컬 저장 레이어 — 키와 접근을 한 곳에서 관리 ─────────────────────────────────────
const STORE_KEY = "wallsync.sources.v1";
const ACTIVE_KEY = "wallsync.active.v1";
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

export function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}
export function saveActiveId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
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
