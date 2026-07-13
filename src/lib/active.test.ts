import { describe, it, expect } from "vitest";
import { resolveActiveScreens, markActive, clearActiveId, activeFromLegacy } from "./active";
import { Source, ActiveMap } from "../types";
import { SyncResult } from "../wallpaper";

const src = (id: string, over: Partial<Source> = {}): Source => ({
  id, name: id, type: "url", url: `https://x.test/${id}`, target: "home",
  auto: false, schedule: null, addedAt: 1, lastApplied: null, ...over,
});
const ok = (id: string, time: number): SyncResult => ({ id, ok: true, time });
const fail = (id: string, time: number): SyncResult => ({ id, ok: false, time, error: "x" });
const none: ActiveMap = { home: null, lock: null };

describe("resolveActiveScreens", () => {
  it("빈 목록이면 두 화면 모두 null", () => {
    const r = resolveActiveScreens([], none, {});
    expect(r.home.src).toBeNull();
    expect(r.lock.src).toBeNull();
  });

  it("수동 적용은 기록된 화면에만 나타난다", () => {
    const a = src("a", { lastApplied: 100 });
    const r = resolveActiveScreens([a], { home: "a", lock: null }, {});
    expect(r.home.src?.id).toBe("a");
    expect(r.home.time).toBe(100);
    expect(r.lock.src).toBeNull();
  });

  it("홈과 잠금에 서로 다른 소스가 각각 적용될 수 있다", () => {
    const a = src("a", { target: "home", lastApplied: 100 });
    const b = src("b", { target: "lock", lastApplied: 200 });
    const r = resolveActiveScreens([a, b], { home: "a", lock: "b" }, {});
    expect(r.home.src?.id).toBe("a");
    expect(r.lock.src?.id).toBe("b");
  });

  it("자동 갱신 성공이 더 최신이면 그 화면의 자동 소스가 이긴다", () => {
    const a = src("a", { lastApplied: 100 });
    const b = src("b", { auto: true, target: "home" });
    const r = resolveActiveScreens([a, b], { home: "a", lock: null }, { b: ok("b", 200) });
    expect(r.home.src?.id).toBe("b");
    expect(r.home.time).toBe(200);
  });

  it("자동 소스는 자기 target 화면에만 반영된다", () => {
    const b = src("b", { auto: true, target: "lock" });
    const r = resolveActiveScreens([b], none, { b: ok("b", 200) });
    expect(r.home.src).toBeNull();
    expect(r.lock.src?.id).toBe("b");
  });

  it("target both 자동 소스는 두 화면 모두 반영된다", () => {
    const b = src("b", { auto: true, target: "both" });
    const r = resolveActiveScreens([b], none, { b: ok("b", 200) });
    expect(r.home.src?.id).toBe("b");
    expect(r.lock.src?.id).toBe("b");
  });

  it("auto가 아닌 소스의 sync 이력·실패한 sync는 무시된다", () => {
    const b = src("b", { auto: false });
    const c = src("c", { auto: true });
    const r = resolveActiveScreens([b, c], none, { b: ok("b", 200), c: fail("c", 300) });
    expect(r.home.src).toBeNull();
  });

  it("기록된 id여도 lastApplied가 없으면 무시된다", () => {
    const a = src("a");
    expect(resolveActiveScreens([a], { home: "a", lock: null }, {}).home.src).toBeNull();
  });
});

describe("markActive / clearActiveId", () => {
  it("target이 덮는 화면에만 기록한다", () => {
    expect(markActive(none, "a", "home")).toEqual({ home: "a", lock: null });
    expect(markActive(none, "a", "lock")).toEqual({ home: null, lock: "a" });
    expect(markActive({ home: "x", lock: "y" }, "a", "both")).toEqual({ home: "a", lock: "a" });
  });
  it("clear는 해당 id가 기록된 화면만 비운다", () => {
    expect(clearActiveId({ home: "a", lock: "b" }, "a")).toEqual({ home: null, lock: "b" });
    expect(clearActiveId({ home: "a", lock: "a" }, "a")).toEqual({ home: null, lock: null });
  });
});

describe("activeFromLegacy", () => {
  it("소스 target 기준으로 화면별 매핑한다", () => {
    const both = src("a", { target: "both" });
    const lock = src("b", { target: "lock" });
    expect(activeFromLegacy([both], "a")).toEqual({ home: "a", lock: "a" });
    expect(activeFromLegacy([lock], "b")).toEqual({ home: null, lock: "b" });
  });
  it("없는 id·null이면 빈 맵", () => {
    expect(activeFromLegacy([src("a")], "zz")).toEqual(none);
    expect(activeFromLegacy([src("a")], null)).toEqual(none);
  });
});
