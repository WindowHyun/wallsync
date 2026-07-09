// 경기 알림 필터 규칙 — 순수 로직 (단위 테스트로 검증하는 명세).
// 실제 런타임 예약은 네이티브 GameNotifyWorker(Java)가 담당하며 아래와 동일한 규칙
// (취소·연기 제외, HH:MM 검증, 과거·중복 제외)을 미러링한다. 이 파일은 그 계약의 기준이다.

export interface SchedGame {
  date: string; time: string; weekday: string; home: boolean;
  opponent: string; opponentEn: string; stadium: string; status: string;
}
export interface SchedResponse {
  team: { id: string; en: string; short: string; name: string };
  games: SchedGame[];
}

export interface PlannedNotification { id: number; title: string; body: string; at: number }

// 알림이 무의미한 경기 상태 (취소·연기 등)
const SKIP_STATUS = /취소|연기|중단|노게임|서스펜디드/;
const TIME_RE = /^\d{1,2}:\d{2}$/;
const MAX_GAMES = 30;

export function notifId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 100000 + (h % 900000);
}

/**
 * 일정 응답에서 예약할 알림 목록을 계산한다.
 * 취소·연기 경기, 시간 미정, 이미 지난(또는 1분 내 임박) 경기는 제외.
 */
export function planGameNotifications(data: SchedResponse, leadMinutes: number, now: number): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const seen = new Set<number>();

  for (const g of data.games.slice(0, MAX_GAMES)) {
    if (g.status && SKIP_STATUS.test(g.status)) continue; // 취소·연기 경기 제외
    if (!TIME_RE.test(g.time)) continue; // 시간 미정 등 비정상 값 제외
    // 경기 시각은 KST 기준 → 타임존 명시해 안전하게 파싱 (한 자리 시각은 패딩)
    const at = new Date(`${g.date}T${g.time.padStart(5, "0")}:00+09:00`).getTime() - leadMinutes * 60000;
    if (!Number.isFinite(at) || at <= now + 60000) continue; // 파싱 실패·이미 지남·1분 내 임박

    const id = notifId(g.date + g.time);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: `⚾ ${data.team.short} 경기 ${leadMinutes}분 전`,
      body: `${g.home ? "vs" : "@"} ${g.opponent} · ${g.time}${g.stadium ? ` · ${g.stadium}` : ""}`,
      at,
    });
  }
  return out;
}
