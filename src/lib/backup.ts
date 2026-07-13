import { Source, NotifSettings, BackupExtra, ActiveMap } from "../types";
import { sanitizeSources } from "./sanitize";

/** v3 백업 직렬화 — 소스 목록 + 경기알림 설정 + 화면별 적용중 상태 */
export function serializeBackup(sources: Source[], notif: NotifSettings, active: ActiveMap): string {
  return JSON.stringify({ version: 3, sources, notif, active }, null, 2);
}

/**
 * 백업 파싱·검증. v1(소스 배열)·v2(activeId)·v3(active 맵) 모두 수용.
 * 형식 오류·유효 항목 0개면 throw.
 */
export function parseBackup(text: string): { sources: Source[]; extra: BackupExtra } {
  const parsed = JSON.parse(text);
  const rawList = Array.isArray(parsed) ? parsed : parsed?.sources;

  // id/url/type 필수 검사 + 나머지 필드(target·schedule·auto·name 등) 보정 —
  // 손상된 백업이 이상 예약·빈 이름 카드로 이어지지 않게 정규화한다.
  const sources = sanitizeSources(rawList);
  if (sources === null) throw new Error("형식이 올바르지 않습니다");
  if (sources.length === 0) throw new Error("유효한 항목이 없습니다");

  const extra: BackupExtra = {};
  if (!Array.isArray(parsed)) {
    const n = parsed.notif;
    if (n && typeof n.enabled === "boolean" && typeof n.team === "string"
        && typeof n.lead === "number" && Number.isFinite(n.lead) && n.lead >= 1) {
      extra.notif = { enabled: n.enabled, team: n.team, lead: n.lead };
    }
    const a = parsed.active;
    if (a && typeof a === "object" && !Array.isArray(a)) {
      // v3 — 화면별 적용중
      extra.active = {
        home: typeof a.home === "string" ? a.home : null,
        lock: typeof a.lock === "string" ? a.lock : null,
      };
    } else if (typeof parsed.activeId === "string" || parsed.activeId === null) {
      // v2 — 단일 activeId (복원 시 소스 target 기준으로 화면별 매핑)
      extra.activeId = parsed.activeId;
    }
  }
  return { sources, extra };
}
