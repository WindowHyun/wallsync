import { LocalNotifications } from "@capacitor/local-notifications";
import { planGameNotifications, SchedResponse } from "./lib/schedule-plan";
import { readSchedCache, writeSchedCache } from "./lib/sched-cache";

// KBO 프로젝트의 일정 JSON API (CORS 허용)
const SCHED_BASE = "https://kbo-wallpaper.vercel.app/api/schedule";
const IDS_KEY = "wallsync.notif.ids";
const FETCH_TIMEOUT_MS = 10000;

/** 현재 알림 권한이 부여돼 있는지 (프롬프트 없이 조회만). */
export async function hasNotifPermission(): Promise<boolean> {
  try {
    const p = await LocalNotifications.checkPermissions();
    return p.display === "granted";
  } catch { return false; }
}

/** 이전에 예약한 경기 알림을 모두 취소한다. */
export async function cancelGameNotifications(): Promise<void> {
  try {
    const raw = localStorage.getItem(IDS_KEY);
    const ids: number[] = raw ? JSON.parse(raw) : [];
    if (ids.length) await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch { /* ignore */ }
  localStorage.removeItem(IDS_KEY);
}

/** 같은 팀·같은 날이면 캐시를, 아니면 네트워크에서 일정을 가져온다. */
async function loadSchedule(team: string): Promise<SchedResponse> {
  const cached = readSchedCache(team, Date.now());
  if (cached) return cached;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SCHED_BASE}?team=${encodeURIComponent(team)}&months=2`, { signal: ctl.signal });
    if (!res.ok) throw new Error("일정을 불러오지 못했습니다");
    const data = (await res.json()) as SchedResponse;
    writeSchedCache(team, Date.now(), data);
    return data;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("일정 서버 응답이 없습니다");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 팀의 다가오는 경기를 받아 시작 leadMinutes 분 전 로컬 알림을 예약한다.
 * 반환값: 예약된 알림 수.
 */
export async function scheduleGameNotifications(team: string, leadMinutes: number): Promise<number> {
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") throw new Error("알림 권한이 거부되었습니다");

  await cancelGameNotifications();

  const data = await loadSchedule(team);
  const planned = planGameNotifications(data, leadMinutes, Date.now());
  if (planned.length) {
    await LocalNotifications.schedule({
      notifications: planned.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        schedule: { at: new Date(p.at), allowWhileIdle: true },
      })),
    });
  }
  localStorage.setItem(IDS_KEY, JSON.stringify(planned.map((p) => p.id)));
  return planned.length;
}
