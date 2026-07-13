import { Source, Schedule, KboConfig } from "../types";
import { WallpaperTarget } from "../wallpaper";

// ─── 외부에서 들어오는 소스 데이터 정규화 ─────────────────────────────────────────────
// 백업 가져오기(parseBackup)와 localStorage 로드(loadSources)가 공유한다.
// id/url/type이 없으면 버리고, 나머지 필드는 안전한 값으로 보정한다 —
// 손상된 백업/저장소가 이상 예약(kind 없는 schedule로 daily 8:00 등)으로
// 이어지지 않게 하는 방어선.

const TARGETS: readonly WallpaperTarget[] = ["home", "lock", "both"];

/* eslint-disable @typescript-eslint/no-explicit-any */

function sanitizeSchedule(raw: any): Schedule | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.kind === "interval" && Number.isFinite(raw.hours) && raw.hours >= 1) {
    return { kind: "interval", hours: raw.hours };
  }
  if (
    raw.kind === "daily" &&
    Number.isInteger(raw.hour) && raw.hour >= 0 && raw.hour <= 23 &&
    Number.isInteger(raw.minute) && raw.minute >= 0 && raw.minute <= 59
  ) {
    return { kind: "daily", hour: raw.hour, minute: raw.minute };
  }
  return null;
}

function sanitizeKbo(raw: any): KboConfig | undefined {
  if (!raw || typeof raw !== "object" || typeof raw.team !== "string" || !raw.team) return undefined;
  return {
    team: raw.team,
    style: typeof raw.style === "string" && raw.style ? raw.style : "minimal",
    mode: typeof raw.mode === "string" && raw.mode ? raw.mode : "dark",
    res: typeof raw.res === "string" && raw.res ? raw.res : "android-fhd",
  };
}

/** 형식이 어긋난 항목은 null, 나머지는 필드 보정된 Source. */
export function sanitizeSource(x: any): Source | null {
  if (!x || typeof x !== "object") return null;
  if (typeof x.id !== "string" || !x.id) return null;
  if (typeof x.url !== "string" || !x.url) return null;
  if (x.type !== "kbo" && x.type !== "url") return null;

  const schedule = sanitizeSchedule(x.schedule);
  return {
    id: x.id,
    name: typeof x.name === "string" && x.name.trim() ? x.name : (x.type === "kbo" ? "KBO 배경화면" : "내 배경화면"),
    type: x.type,
    url: x.url,
    target: TARGETS.includes(x.target) ? x.target : "both",
    kbo: x.type === "kbo" ? sanitizeKbo(x.kbo) : undefined,
    auto: x.auto === true && schedule !== null, // 유효한 schedule 없이 auto가 켜진 채 들어오지 않게
    schedule,
    addedAt: Number.isFinite(x.addedAt) ? x.addedAt : Date.now(),
    lastApplied: Number.isFinite(x.lastApplied) ? x.lastApplied : null,
  };
}

/** 배열에서 유효 항목만 정규화해 반환 (배열이 아니면 null). */
export function sanitizeSources(raw: any): Source[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map(sanitizeSource).filter((s): s is Source => s !== null);
}
