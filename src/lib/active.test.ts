import { describe, it, expect } from "vitest";
import { resolveActive } from "./active";
import { Source } from "../types";
import { SyncResult } from "../wallpaper";

const src = (id: string, over: Partial<Source> = {}): Source => ({
  id, name: id, type: "url", url: `https://x.test/${id}`, target: "home",
  auto: false, schedule: null, addedAt: 1, lastApplied: null, ...over,
});
const ok = (id: string, time: number): SyncResult => ({ id, ok: true, time });
const fail = (id: string, time: number): SyncResult => ({ id, ok: false, time, error: "x" });

describe("resolveActive", () => {
  it("빈 목록이면 null", () => {
    expect(resolveActive([], null, {})).toEqual({ src: null, time: 0 });
  });

  it("수동 적용만 있으면 activeId 소스", () => {
    const a = src("a", { lastApplied: 100 });
    const r = resolveActive([a, src("b")], "a", {});
    expect(r.src?.id).toBe("a");
    expect(r.time).toBe(100);
  });

  it("자동 갱신 성공이 수동 적용보다 최신이면 자동 소스가 이긴다", () => {
    const a = src("a", { lastApplied: 100 });
    const b = src("b", { auto: true });
    const r = resolveActive([a, b], "a", { b: ok("b", 200) });
    expect(r.src?.id).toBe("b");
    expect(r.time).toBe(200);
  });

  it("수동 적용이 더 최신이면 수동 소스가 이긴다", () => {
    const a = src("a", { lastApplied: 300 });
    const b = src("b", { auto: true });
    expect(resolveActive([a, b], "a", { b: ok("b", 200) }).src?.id).toBe("a");
  });

  it("auto가 아닌 소스의 sync 이력은 무시된다", () => {
    const b = src("b", { auto: false });
    expect(resolveActive([b], null, { b: ok("b", 200) }).src).toBeNull();
  });

  it("실패한 sync는 적용으로 치지 않는다", () => {
    const b = src("b", { auto: true });
    expect(resolveActive([b], null, { b: fail("b", 200) }).src).toBeNull();
  });

  it("activeId가 있어도 lastApplied가 없으면 무시된다", () => {
    const a = src("a"); // lastApplied: null
    expect(resolveActive([a], "a", {}).src).toBeNull();
  });
});
