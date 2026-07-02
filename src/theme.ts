import { Source } from "./types";

// ─── 테마 팔레트 ─────────────────────────────────────────────────────────────────
export const C = {
  bg: "#08080F", surface: "#111118", card: "#18181F", cardHover: "#1E1E28",
  border: "#26263A", accent: "#5B4FE8", accentSoft: "rgba(91,79,232,0.18)",
  teal: "#00C9A7", tealSoft: "rgba(0,201,167,0.15)",
  text: "#EEEEF5", sub: "#9898B8", muted: "#55557A",
  success: "#22C55E", error: "#EF4444", warn: "#F59E0B",
};

// 구단별 대표색 (다크 배경에서 잘 보이도록 보정)
export const TEAM_COLORS: Record<string, string> = {
  KIA: "#E4002B", SAMSUNG: "#2E6CC4", LG: "#D6004E", DOOSAN: "#3A4D8F",
  SSG: "#E81E33", LOTTE: "#2D5BA8", HANWHA: "#FF7A1A", NC: "#3D6CB0",
  KIWOOM: "#A8324E", KT: "#5A6270",
};

export const teamColor = (s: Source) =>
  (s.type === "kbo" && s.kbo && TEAM_COLORS[s.kbo.team]) || C.accent;
