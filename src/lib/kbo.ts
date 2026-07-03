import { KboConfig } from "../types";

// ─── KBO 빌더 옵션 ───────────────────────────────────────────────────────────────
export const KBO_BASE = "https://kbo-wallpaper.vercel.app/api/wallpaper";

export const TEAMS = [
  ["KIA", "KIA 타이거즈"], ["SAMSUNG", "삼성 라이온즈"], ["LG", "LG 트윈스"],
  ["DOOSAN", "두산 베어스"], ["SSG", "SSG 랜더스"], ["LOTTE", "롯데 자이언츠"],
  ["HANWHA", "한화 이글스"], ["NC", "NC 다이노스"], ["KIWOOM", "키움 히어로즈"], ["KT", "KT 위즈"],
];
export const STYLES = [
  ["minimal", "미니멀"], ["mascot", "마스코트"], ["brutal", "브루탈"], ["nighter", "나이터"],
  ["sketch", "스케치"], ["newspaper", "신문"], ["bento", "벤토"], ["kpop-card", "K-POP 카드"],
  ["led-scoreboard", "전광판"], ["grass", "잔디"], ["dots", "도트"], ["diamond", "다이아몬드"], ["list", "리스트"],
];
export const MODES = [["dark", "다크"], ["light", "라이트"]];
export const RES = [
  ["android-fhd", "안드로이드 FHD (1080×2400)"], ["android-qhd", "안드로이드 QHD (1440×3120)"],
  ["iphone-15-pro", "아이폰 15 Pro"], ["iphone-15-pro-max", "아이폰 15 Pro Max"],
  ["iphone-17", "아이폰 17"], ["iphone-17-pro-max", "아이폰 17 Pro Max"], ["iphone-se", "아이폰 SE"],
];

export const buildKboUrl = (k: KboConfig) =>
  `${KBO_BASE}?team=${encodeURIComponent(k.team)}&style=${k.style}&mode=${k.mode}&res=${k.res}`;
