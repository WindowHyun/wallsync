import { describe, it, expect, beforeEach, vi } from "vitest";
import { dayKey, readSchedCache, writeSchedCache } from "./sched-cache";
import { SchedResponse } from "./schedule-plan";

// jsdom 없이 동작하도록 최소 localStorage 목
function mockStorage() {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  });
}

const resp: SchedResponse = {
  team: { id: "LG", en: "lg", short: "LG", name: "LG 트윈스" },
  games: [],
};
const T = Date.parse("2026-07-10T15:00:00+09:00");

describe("dayKey", () => {
  it("YYYY-MM-DD 형식", () => {
    expect(dayKey(Date.parse("2026-07-05T12:00:00"))).toBe("2026-07-05");
    expect(dayKey(Date.parse("2026-01-09T12:00:00"))).toBe("2026-01-09"); // 0 패딩
  });
});

describe("readSchedCache / writeSchedCache", () => {
  beforeEach(() => mockStorage());

  it("캐시가 없으면 null", () => {
    expect(readSchedCache("LG", T)).toBeNull();
  });

  it("같은 팀·같은 날이면 캐시 반환", () => {
    writeSchedCache("LG", T, resp);
    expect(readSchedCache("LG", T)).toEqual(resp);
  });

  it("다른 팀이면 미스", () => {
    writeSchedCache("LG", T, resp);
    expect(readSchedCache("KIA", T)).toBeNull();
  });

  it("다음 날이면 미스 (일 1회 갱신)", () => {
    writeSchedCache("LG", T, resp);
    const nextDay = T + 24 * 3600 * 1000;
    expect(readSchedCache("LG", nextDay)).toBeNull();
  });

  it("손상된 JSON이어도 throw 없이 null", () => {
    localStorage.setItem("wallsync.sched.cache.v1", "{broken");
    expect(readSchedCache("LG", T)).toBeNull();
  });
});
