import { describe, it, expect } from "vitest";
import { serializeBackup, parseBackup } from "./backup";
import { Source, NotifSettings } from "../types";

const src = (id: string, over: Partial<Source> = {}): Source => ({
  id, name: `이름-${id}`, type: "kbo", url: `https://x.test/${id}.png`, target: "both",
  auto: false, schedule: null, addedAt: 1, lastApplied: null, ...over,
});
const notif: NotifSettings = { enabled: true, team: "LG", lead: 60 };

describe("serializeBackup / parseBackup (v2)", () => {
  it("직렬화 후 파싱하면 소스·알림·activeId가 복원된다", () => {
    const text = serializeBackup([src("a"), src("b")], notif, "a");
    const r = parseBackup(text);
    expect(r.sources.map((s) => s.id)).toEqual(["a", "b"]);
    expect(r.extra.notif).toEqual(notif);
    expect(r.extra.activeId).toBe("a");
  });

  it("activeId가 null이어도 extra에 null로 복원된다", () => {
    const r = parseBackup(serializeBackup([src("a")], notif, null));
    expect(r.extra.activeId).toBeNull();
  });

  it("잘못된 notif 형태는 extra에서 제외된다", () => {
    const text = JSON.stringify({ version: 2, sources: [src("a")], notif: { enabled: "yes" } });
    expect(parseBackup(text).extra.notif).toBeUndefined();
  });
});

describe("parseBackup (v1 배열 호환)", () => {
  it("소스 배열만 있어도 파싱된다 (extra 없음)", () => {
    const r = parseBackup(JSON.stringify([src("a")]));
    expect(r.sources).toHaveLength(1);
    expect(r.extra).toEqual({});
  });
});

describe("parseBackup 검증", () => {
  it("배열/객체가 아니면 throw", () => {
    expect(() => parseBackup('"hello"')).toThrow("형식이 올바르지 않습니다");
    expect(() => parseBackup('{"sources": 3}')).toThrow("형식이 올바르지 않습니다");
  });

  it("유효 항목이 0개면 throw", () => {
    expect(() => parseBackup("[]")).toThrow("유효한 항목이 없습니다");
    expect(() => parseBackup('[{"id": 1}]')).toThrow("유효한 항목이 없습니다");
  });

  it("필수 필드가 없는 항목은 걸러진다", () => {
    const bad = { id: "x" }; // url/type 없음
    const r = parseBackup(JSON.stringify([src("a"), bad, { ...src("b"), type: "??" }]));
    expect(r.sources.map((s) => s.id)).toEqual(["a"]);
  });
});
