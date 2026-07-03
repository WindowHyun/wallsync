import { describe, it, expect } from "vitest";
import { buildKboUrl, TEAMS, STYLES } from "./kbo";

describe("buildKboUrl", () => {
  it("쿼리 파라미터가 모두 포함된다", () => {
    const url = buildKboUrl({ team: "LG", style: "minimal", mode: "dark", res: "android-fhd" });
    expect(url).toBe("https://kbo-wallpaper.vercel.app/api/wallpaper?team=LG&style=minimal&mode=dark&res=android-fhd");
  });
  it("팀 값은 URL 인코딩된다", () => {
    expect(buildKboUrl({ team: "A B", style: "s", mode: "m", res: "r" })).toContain("team=A%20B");
  });
});

describe("옵션 데이터 무결성", () => {
  it("10개 구단, 중복 없음", () => {
    expect(TEAMS).toHaveLength(10);
    expect(new Set(TEAMS.map(([v]) => v)).size).toBe(10);
  });
  it("스타일 키 중복 없음", () => {
    expect(new Set(STYLES.map(([v]) => v)).size).toBe(STYLES.length);
  });
});
