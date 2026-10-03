import { describe, it, expect } from "vitest";
import { validateImageUrl } from "./url";

describe("validateImageUrl", () => {
  it("https URL 통과 (앞뒤 공백은 제거)", () => {
    expect(validateImageUrl("  https://example.com/a.png?x=1 ")).toEqual({ ok: true, url: "https://example.com/a.png?x=1" });
  });
  it("빈 값은 거부", () => {
    expect(validateImageUrl("   ").ok).toBe(false);
  });
  it("URL이 아닌 문자열은 거부", () => {
    const r = validateImageUrl("not a url at all");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("형식");
  });
  it("http 는 거부하고 이유를 알려준다", () => {
    const r = validateImageUrl("http://example.com/a.png");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("https");
  });
  it("javascript:, data:, file: 등 다른 스킴은 거부", () => {
    for (const u of ["javascript:alert(1)", "data:image/png;base64,AAAA", "file:///sdcard/a.png", "ftp://x.com/a.png"]) {
      expect(validateImageUrl(u).ok).toBe(false);
    }
  });
  it("https:// 만 있고 호스트가 없으면 거부", () => {
    expect(validateImageUrl("https://").ok).toBe(false);
  });
});
