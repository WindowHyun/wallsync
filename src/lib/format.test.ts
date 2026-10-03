import { describe, it, expect } from "vitest";
import { scheduleLabel, leadLabel, targetLabel, metaLabel, syncLabel } from "./format";
import { Source } from "../types";

describe("scheduleLabel", () => {
  it("null → 빈 문자열", () => expect(scheduleLabel(null)).toBe(""));
  it("interval", () => expect(scheduleLabel({ kind: "interval", hours: 6 })).toBe("6시간마다"));
  it("daily는 0 패딩", () => expect(scheduleLabel({ kind: "daily", hour: 8, minute: 5 })).toBe("매일 08:05"));
});

describe("leadLabel", () => {
  it("60분 미만은 분", () => expect(leadLabel(30)).toBe("30분"));
  it("정각 시간", () => expect(leadLabel(120)).toBe("2시간"));
  it("시간+분 혼합", () => expect(leadLabel(150)).toBe("2시간 30분"));
});

describe("targetLabel", () => {
  it("home/lock/both", () => {
    expect(targetLabel("home")).toBe("홈");
    expect(targetLabel("lock")).toBe("잠금");
    expect(targetLabel("both")).toBe("홈+잠금");
  });
});

const base: Source = { id: "1", name: "x", type: "url", url: "https://example.com/a/wall.png", target: "both", auto: false, schedule: null, addedAt: 0, lastApplied: null };

describe("metaLabel", () => {
  it("KBO는 구단·스타일·모드 한글 라벨", () => {
    const s: Source = { ...base, type: "kbo", kbo: { team: "DOOSAN", style: "minimal", mode: "dark", res: "android-fhd" } };
    expect(metaLabel(s)).toBe("KBO · 두산 베어스 · 미니멀 · 다크");
  });
  it("알 수 없는 값은 원문 유지", () => {
    const s: Source = { ...base, type: "kbo", kbo: { team: "ZZZ", style: "new", mode: "dark", res: "x" } };
    expect(metaLabel(s)).toBe("KBO · ZZZ · new · 다크");
  });
  it("URL은 host/path", () => expect(metaLabel(base)).toBe("URL · example.com/a/wall.png"));
  it("루트 경로는 host만", () => expect(metaLabel({ ...base, url: "https://example.com/" })).toBe("URL · example.com"));
  it("파싱 불가 URL도 깨지지 않는다", () => expect(metaLabel({ ...base, url: "not a url" })).toBe("URL · not a url"));
});

describe("syncLabel", () => {
  it("이력 없으면 null", () => expect(syncLabel(undefined)).toBeNull());
  it("성공은 '갱신됨 · 성공'", () => {
    const r = syncLabel({ id: "1", ok: true, time: Date.now() - 5 * 60000 });
    expect(r?.text).toBe("5분 전 갱신됨 · 성공");
    expect(r?.ok).toBe(true);
  });
  it("실패는 사유 포함", () => {
    const r = syncLabel({ id: "1", ok: false, time: Date.now(), error: "HTTP 404" });
    expect(r?.text).toBe("자동 갱신 실패 · HTTP 404");
    expect(r?.ok).toBe(false);
  });
});
