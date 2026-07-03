import { Source, NotifSettings, BackupExtra } from "../types";

/** v2 백업 직렬화 — 소스 목록 + 경기알림 설정 + 적용중 상태 */
export function serializeBackup(sources: Source[], notif: NotifSettings, activeId: string | null): string {
  return JSON.stringify({ version: 2, sources, notif, activeId }, null, 2);
}

/**
 * 백업 파싱·검증. v1(소스 배열)과 v2({ sources, notif, activeId }) 모두 수용.
 * 형식 오류·유효 항목 0개면 throw.
 */
export function parseBackup(text: string): { sources: Source[]; extra: BackupExtra } {
  const parsed = JSON.parse(text);
  const rawList = Array.isArray(parsed) ? parsed : parsed?.sources;
  if (!Array.isArray(rawList)) throw new Error("형식이 올바르지 않습니다");

  const sources = rawList.filter(
    (x) => x && typeof x.id === "string" && typeof x.url === "string" && (x.type === "kbo" || x.type === "url"),
  ) as Source[];
  if (sources.length === 0) throw new Error("유효한 항목이 없습니다");

  const extra: BackupExtra = {};
  if (!Array.isArray(parsed)) {
    const n = parsed.notif;
    if (n && typeof n.enabled === "boolean" && typeof n.team === "string" && typeof n.lead === "number") {
      extra.notif = n;
    }
    if (typeof parsed.activeId === "string" || parsed.activeId === null) {
      extra.activeId = parsed.activeId;
    }
  }
  return { sources, extra };
}
