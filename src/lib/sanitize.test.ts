import { describe, it, expect } from "vitest";
import { sanitizeSource, sanitizeSources } from "./sanitize";

const base = {
  id: "a", name: "이름", type: "url", url: "https://x.test/a.png", target: "home",
  auto: false, schedule: null, addedAt: 1, lastApplied: null,
};

describe("sanitizeSource — 필수 필드", () => {
  it("정상 항목은 그대로 통과한다", () => {
    expect(sanitizeSource(base)).toEqual(base);
  });

  it("id/url/type이 없거나 잘못되면 버린다", () => {
    expect(sanitizeSource(null)).toBeNull();
    expect(sanitizeSource({})).toBeNull();
    expect(sanitizeSource({ ...base, id: 1 })).toBeNull();
    expect(sanitizeSource({ ...base, url: "" })).toBeNull();
    expect(sanitizeSource({ ...base, type: "??" })).toBeNull();
  });
});

describe("sanitizeSource — 필드 보정", () => {
  it("target이 이상하면 both로 보정한다", () => {
    expect(sanitizeSource({ ...base, target: "everywhere" })?.target).toBe("both");
    expect(sanitizeSource({ ...base, target: undefined })?.target).toBe("both");
  });

  it("이름이 없으면 타입별 기본 이름을 준다", () => {
    expect(sanitizeSource({ ...base, name: "" })?.name).toBe("내 배경화면");
    expect(sanitizeSource({ ...base, type: "kbo", name: undefined })?.name).toBe("KBO 배경화면");
  });

  it("kind 없는 schedule은 null이 되고 auto도 꺼진다 (이상 예약 방지)", () => {
    const r = sanitizeSource({ ...base, auto: true, schedule: {} });
    expect(r?.schedule).toBeNull();
    expect(r?.auto).toBe(false);
  });

  it("범위를 벗어난 daily 시각은 버려진다", () => {
    expect(sanitizeSource({ ...base, schedule: { kind: "daily", hour: 25, minute: 0 } })?.schedule).toBeNull();
    expect(sanitizeSource({ ...base, schedule: { kind: "daily", hour: 8, minute: 60 } })?.schedule).toBeNull();
    expect(sanitizeSource({ ...base, schedule: { kind: "daily", hour: 8, minute: 30 } })?.schedule)
      .toEqual({ kind: "daily", hour: 8, minute: 30, wifiOnly: false, charging: false });
  });

  it("interval hours가 숫자가 아니거나 1 미만이면 버려진다", () => {
    expect(sanitizeSource({ ...base, schedule: { kind: "interval", hours: "6" } })?.schedule).toBeNull();
    expect(sanitizeSource({ ...base, schedule: { kind: "interval", hours: 0 } })?.schedule).toBeNull();
    expect(sanitizeSource({ ...base, schedule: { kind: "interval", hours: 6 } })?.schedule)
      .toEqual({ kind: "interval", hours: 6, wifiOnly: false, charging: false });
  });

  it("실행 조건(wifiOnly/charging)은 boolean true일 때만 보존된다", () => {
    const s = sanitizeSource({ ...base, schedule: { kind: "interval", hours: 6, wifiOnly: true, charging: "yes" } })?.schedule;
    expect(s?.wifiOnly).toBe(true);
    expect(s?.charging).toBe(false);
  });

  it("schedule이 유효하면 auto=true가 유지된다", () => {
    const r = sanitizeSource({ ...base, auto: true, schedule: { kind: "interval", hours: 6 } });
    expect(r?.auto).toBe(true);
  });

  it("lastApplied/addedAt이 숫자가 아니면 초기화된다", () => {
    const r = sanitizeSource({ ...base, lastApplied: "어제", addedAt: null });
    expect(r?.lastApplied).toBeNull();
    expect(typeof r?.addedAt).toBe("number");
  });

  it("url 타입의 kbo 설정은 제거되고, kbo 타입은 team만 있으면 나머지가 보정된다", () => {
    expect(sanitizeSource({ ...base, kbo: { team: "LG" } })?.kbo).toBeUndefined();
    const k = sanitizeSource({ ...base, type: "kbo", kbo: { team: "LG" } })?.kbo;
    expect(k).toEqual({ team: "LG", style: "minimal", mode: "dark", res: "android-fhd" });
  });
});

describe("sanitizeSources", () => {
  it("배열이 아니면 null", () => {
    expect(sanitizeSources("x")).toBeNull();
    expect(sanitizeSources({ sources: [] })).toBeNull();
  });
  it("유효 항목만 남긴다", () => {
    expect(sanitizeSources([base, {}, null, { ...base, id: "b" }])?.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
