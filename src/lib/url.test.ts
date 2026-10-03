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
  it("http URL 도 통과 (앱이 cleartext 를 전역 허용하는 것이 의도된 계약)", () => {
    expect(validateImageUrl("http://example.com/a.png")).toEqual({ ok: true, url: "http://example.com/a.png" });
  });
  it("javascript:, data:, file: 등 다른 스킴은 거부", () => {
    for (const u of ["javascript:alert(1)", "data:image/png;base64,AAAA", "file:///sdcard/a.png", "ftp://x.com/a.png"]) {
      expect(validateImageUrl(u).ok).toBe(false);
    }
  });
  it("호스트가 없으면 거부", () => {
    expect(validateImageUrl("https://").ok).toBe(false);
    expect(validateImageUrl("http://").ok).toBe(false);
  });
});
