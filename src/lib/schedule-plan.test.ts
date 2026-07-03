import { describe, it, expect } from "vitest";
import { planGameNotifications, notifId, SchedResponse, SchedGame } from "./schedule-plan";

const game = (over: Partial<SchedGame> = {}): SchedGame => ({
  date: "2026-07-10", time: "18:30", weekday: "금", home: true,
  opponent: "두산", opponentEn: "doosan", stadium: "잠실", status: "예정", ...over,
});
const resp = (games: SchedGame[]): SchedResponse => ({
  team: { id: "LG", en: "lg", short: "LG", name: "LG 트윈스" },
  games,
});

// 기준 시각: 2026-07-01 00:00 KST
const NOW = Date.parse("2026-07-01T00:00:00+09:00");
const LEAD = 60;

describe("planGameNotifications", () => {
  it("정상 경기는 시작 lead분 전으로 예약된다", () => {
    const r = planGameNotifications(resp([game()]), LEAD, NOW);
    expect(r).toHaveLength(1);
    expect(r[0].at).toBe(Date.parse("2026-07-10T18:30:00+09:00") - LEAD * 60000);
    expect(r[0].title).toContain("LG");
    expect(r[0].title).toContain("60분 전");
    expect(r[0].body).toContain("vs 두산");
  });

  it("원정 경기는 @ 표기", () => {
    const r = planGameNotifications(resp([game({ home: false })]), LEAD, NOW);
    expect(r[0].body).toContain("@ 두산");
  });

  it("취소·연기·중단 경기는 제외된다", () => {
    const games = [game({ status: "우천취소" }), game({ date: "2026-07-11", status: "경기연기" }), game({ date: "2026-07-12", status: "서스펜디드" })];
    expect(planGameNotifications(resp(games), LEAD, NOW)).toHaveLength(0);
  });

  it("시간 미정 등 비정상 시간 값은 제외된다", () => {
    const games = [game({ time: "미정" }), game({ date: "2026-07-11", time: "" })];
    expect(planGameNotifications(resp(games), LEAD, NOW)).toHaveLength(0);
  });

  it("이미 지난 경기는 제외된다", () => {
    expect(planGameNotifications(resp([game({ date: "2026-06-30" })]), LEAD, NOW)).toHaveLength(0);
  });

  it("한 자리 시각(8:30)도 올바르게 파싱된다", () => {
    const r = planGameNotifications(resp([game({ time: "8:30" })]), LEAD, NOW);
    expect(r).toHaveLength(1);
    expect(r[0].at).toBe(Date.parse("2026-07-10T08:30:00+09:00") - LEAD * 60000);
  });

  it("같은 날짜·시각 중복 경기는 한 번만 예약된다", () => {
    expect(planGameNotifications(resp([game(), game()]), LEAD, NOW)).toHaveLength(1);
  });

  it("최대 30경기까지만 처리한다", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      game({ date: `2026-08-${String((i % 28) + 1).padStart(2, "0")}`, time: `${10 + Math.floor(i / 28)}:00` }));
    expect(planGameNotifications(resp(many), LEAD, NOW).length).toBeLessThanOrEqual(30);
  });
});

describe("notifId", () => {
  it("결정적이고 100000~999999 범위", () => {
    const id = notifId("2026-07-10" + "18:30");
    expect(id).toBe(notifId("2026-07-1018:30"));
    expect(id).toBeGreaterThanOrEqual(100000);
    expect(id).toBeLessThan(1000000);
  });
  it("다른 입력이면 다른 id (일반적으로)", () => {
    expect(notifId("a")).not.toBe(notifId("b"));
  });
});
