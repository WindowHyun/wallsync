import { LocalNotifications, LocalNotificationSchema } from "@capacitor/local-notifications";

// KBO 프로젝트의 일정 JSON API (CORS 허용)
const SCHED_BASE = "https://kbo-wallpaper.vercel.app/api/schedule";
const IDS_KEY = "wallsync.notif.ids";

interface SchedGame {
  date: string; time: string; weekday: string; home: boolean;
  opponent: string; opponentEn: string; stadium: string; status: string;
}
interface SchedResponse {
  team: { id: string; en: string; short: string; name: string };
  games: SchedGame[];
}

function notifId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 100000 + (h % 900000);
}

// 알림이 무의미한 경기 상태 (취소·연기 등)
const SKIP_STATUS = /취소|연기|중단|노게임|서스펜디드/;
const TIME_RE = /^\d{1,2}:\d{2}$/;
const FETCH_TIMEOUT_MS = 10000;

/** 이전에 예약한 경기 알림을 모두 취소한다. */
export async function cancelGameNotifications(): Promise<void> {
  try {
    const raw = localStorage.getItem(IDS_KEY);
    const ids: number[] = raw ? JSON.parse(raw) : [];
    if (ids.length) await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch { /* ignore */ }
  localStorage.removeItem(IDS_KEY);
}

/**
 * 팀의 다가오는 경기를 받아 시작 leadMinutes 분 전 로컬 알림을 예약한다.
 * 반환값: 예약된 알림 수.
 */
export async function scheduleGameNotifications(team: string, leadMinutes: number): Promise<number> {
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") throw new Error("알림 권한이 거부되었습니다");

  await cancelGameNotifications();

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  let data: SchedResponse;
  try {
    const res = await fetch(`${SCHED_BASE}?team=${encodeURIComponent(team)}&months=2`, { signal: ctl.signal });
    if (!res.ok) throw new Error("일정을 불러오지 못했습니다");
    data = (await res.json()) as SchedResponse;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("일정 서버 응답이 없습니다");
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const now = Date.now();
  const notifs: LocalNotificationSchema[] = [];
  const ids: number[] = [];

  for (const g of data.games.slice(0, 30)) {
    if (g.status && SKIP_STATUS.test(g.status)) continue; // 취소·연기 경기 제외
    if (!TIME_RE.test(g.time)) continue; // 시간 미정 등 비정상 값 제외
    // 경기 시각은 KST 기준 → 타임존 명시해 안전하게 파싱
    const at = new Date(`${g.date}T${g.time.padStart(5, "0")}:00+09:00`).getTime() - leadMinutes * 60000;
    if (!Number.isFinite(at) || at <= now + 60000) continue; // 파싱 실패·이미 지남·1분 내 임박
    const id = notifId(g.date + g.time);
    if (ids.includes(id)) continue;
    ids.push(id);
    notifs.push({
      id,
      title: `⚾ ${data.team.short} 경기 ${leadMinutes}분 전`,
      body: `${g.home ? "vs" : "@"} ${g.opponent} · ${g.time}${g.stadium ? ` · ${g.stadium}` : ""}`,
      schedule: { at: new Date(at), allowWhileIdle: true },
    });
  }

  if (notifs.length) await LocalNotifications.schedule({ notifications: notifs });
  localStorage.setItem(IDS_KEY, JSON.stringify(ids));
  return notifs.length;
}
