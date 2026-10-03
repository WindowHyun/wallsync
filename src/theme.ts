import { Source } from "./types";

// ─── 테마 팔레트 ─────────────────────────────────────────────────────────────────
// 글자색은 카드(#1A1A26) 위에서 4.5:1 이상: text 15.4 · sub 8.1 · muted 5.4 · accentText 10.6 · teal 9.2 · error 6.3
// 컨트롤 테두리(borderStrong)는 배경 대비 3:1 이상.
export const C = {
  bg: "#0B0B12", surface: "#14141D", card: "#1A1A26", border: "#2C2C42", borderStrong: "#6B6B90",
  accent: "#5B4FE8", accentLine: "#A9A3FF", accentText: "#C9C5FF", accentSoft: "rgba(106,103,224,0.22)", activeLine: "#6A67E0",
  segmentOn: "#34345A",
  teal: "#2DD4B4", tealSoft: "rgba(45,212,180,0.14)", tealWash: "rgba(45,212,180,0.10)", tealLine: "rgba(45,212,180,0.35)",
  text: "#F2F2F8", sub: "#B0B0CC", muted: "#8E8EAE",
  success: "#3DDC84", error: "#FF6B7A", warn: "#F5B74A",
  warnWash: "rgba(245,183,74,0.10)", warnLine: "rgba(245,183,74,0.45)",
  // 토스트 바탕 (흰 글자 5:1 이상 / warn 은 어두운 글자)
  toastSuccess: "#14803F", toastError: "#C62F41", onWarn: "#1A1206",
  disabledBg: "#1E1E2C", disabledLine: "#3A3A55",
};

// 구단별 대표색 (다크 배경에서 잘 보이도록 보정)
export const TEAM_COLORS: Record<string, string> = {
  KIA: "#E4002B", SAMSUNG: "#2E6CC4", LG: "#D6004E", DOOSAN: "#3A4D8F",
  SSG: "#E81E33", LOTTE: "#2D5BA8", HANWHA: "#FF7A1A", NC: "#3D6CB0",
  KIWOOM: "#A8324E", KT: "#5A6270",
};

export const teamColor = (s: Source) =>
  (s.type === "kbo" && s.kbo && TEAM_COLORS[s.kbo.team]) || C.accent;
