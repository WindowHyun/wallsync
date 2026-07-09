import { Capacitor } from "@capacitor/core";
import { Wallpaper } from "./wallpaper";

// 경기 알림은 네이티브 백그라운드 워커(GameNotifyWorker)가 담당한다.
// 매일 일정을 다시 받아 AlarmManager로 재예약하므로, 앱을 열지 않아도 알림이 끊기지 않는다.
// (Capacitor LocalNotifications는 앱이 열려 있을 때만 재예약 가능해 자동 연장이 안 됨)

const native = Capacitor.isNativePlatform();

/** 현재 알림 권한이 부여돼 있는지 (프롬프트 없이 조회만). */
export async function hasNotifPermission(): Promise<boolean> {
  if (!native) return false;
  try {
    const r = await Wallpaper.hasNotificationPermission();
    return r.granted;
  } catch { return false; }
}

/** 경기 알림 자동 연장 워커를 등록한다 (권한 확인 후). */
export async function scheduleGameNotifications(team: string, lead: number): Promise<void> {
  if (!native) throw new Error("알림은 설치된 앱에서만 동작합니다");
  const perm = await Wallpaper.requestNotificationPermission();
  if (!perm.granted) throw new Error("알림 권한이 거부되었습니다");
  await Wallpaper.scheduleGameWorker({ team, lead });
}

/** 경기 알림 워커·예약 알람을 모두 해제한다. */
export async function cancelGameNotifications(): Promise<void> {
  if (!native) return;
  try { await Wallpaper.cancelGameWorker(); } catch { /* ignore */ }
}
