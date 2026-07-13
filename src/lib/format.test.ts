import { describe, it, expect } from "vitest";
import { scheduleLabel, leadLabel, targetLabel } from "./format";

describe("scheduleLabel", () => {
  it("null → 빈 문자열", () => expect(scheduleLabel(null)).toBe(""));
  it("interval", () => expect(scheduleLabel({ kind: "interval", hours: 6 })).toBe("6시간마다"));
  it("daily는 0 패딩", () => expect(scheduleLabel({ kind: "daily", hour: 8, minute: 5 })).toBe("매일 08:05"));
  it("실행 조건 마커", () =>
    expect(scheduleLabel({ kind: "interval", hours: 6, wifiOnly: true, charging: true })).toBe("6시간마다 ·📶 ·🔌"));
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
