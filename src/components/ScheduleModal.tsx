import { useState } from "react";
import { Source, Schedule } from "../types";
import { C } from "../theme";

// ─── 예약 모달 ────────────────────────────────────────────────────────────────────
export function ScheduleModal({ src, onSave, onTest, onClose }: { src: Source; onSave: (auto: boolean, s: Schedule | null) => void; onTest: () => void; onClose: () => void }) {
  const [enabled, setEnabled] = useState(src.auto);
  const [kind, setKind] = useState<"interval" | "daily">(src.schedule?.kind ?? "interval");
  const [hours, setHours] = useState(src.schedule?.kind === "interval" ? src.schedule.hours : 6);
  const [hour, setHour] = useState(src.schedule?.kind === "daily" ? src.schedule.hour : 8);
  const [minute, setMinute] = useState(src.schedule?.kind === "daily" ? src.schedule.minute : 0);
  const [wifiOnly, setWifiOnly] = useState(src.schedule?.wifiOnly ?? false);
  const [charging, setCharging] = useState(src.schedule?.charging ?? false);

  // 백업 복원 등으로 목록 밖 분값이 들어와도 select가 빈 값으로 보이지 않게 현재 값 포함
  const minuteOpts = Array.from(new Set([...[0, 10, 15, 20, 30, 45], minute])).sort((a, b) => a - b);

  const save = () => {
    if (!enabled) { onSave(false, null); onClose(); return; }
    const s: Schedule = kind === "interval"
      ? { kind, hours, wifiOnly, charging }
      : { kind: "daily", hour, minute, wifiOnly, charging };
    onSave(true, s);
    onClose();
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{ background: C.card, borderRadius: 20, padding: 26, width: "100%", maxWidth: 380, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>⏰ 자동 갱신 설정</h3>
          <button onClick={onClose} aria-label="닫기" style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        <div onClick={() => setEnabled((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, cursor: "pointer" }}>
          <div style={{ width: 40, height: 22, borderRadius: 11, background: enabled ? C.accent : C.border, position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 3, left: enabled ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
          </div>
          <span style={{ fontSize: 14, color: enabled ? C.text : C.sub, fontWeight: 600 }}>자동 갱신 {enabled ? "켜짐" : "꺼짐"}</span>
        </div>

        <div style={{ opacity: enabled ? 1 : 0.4, pointerEvents: enabled ? "auto" : "none" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["interval", "⏱ 반복 주기"], ["daily", "🌅 매일 특정 시간"]].map(([v, l]) => (
              <button key={v} onClick={() => setKind(v as "interval" | "daily")} style={{
                flex: 1, padding: "9px 0", borderRadius: 10,
                border: `1.5px solid ${kind === v ? C.accent : C.border}`,
                background: kind === v ? C.accentSoft : "transparent",
                color: kind === v ? C.text : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>{l}</button>
            ))}
          </div>

          {kind === "interval" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[1, 2, 3, 4, 6, 8, 12, 24].map((h) => (
                <button key={h} onClick={() => setHours(h)} style={{
                  padding: "7px 14px", borderRadius: 8,
                  border: `1.5px solid ${hours === h ? C.accent : C.border}`,
                  background: hours === h ? C.accentSoft : "transparent",
                  color: hours === h ? C.text : C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>{h}h</button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <select value={hour} onChange={(e) => setHour(+e.target.value)} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 14 }}>
                {Array.from({ length: 24 }, (_, i) => i).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}시</option>)}
              </select>
              <select value={minute} onChange={(e) => setMinute(+e.target.value)} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 14 }}>
                {minuteOpts.map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}분</option>)}
              </select>
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 11, color: C.sub, fontWeight: 600, marginBottom: 6 }}>실행 조건</div>
          <div style={{ display: "flex", gap: 8 }}>
            {([["📶 Wi-Fi에서만", wifiOnly, setWifiOnly], ["🔌 충전 중에만", charging, setCharging]] as const).map(([label, on, set]) => (
              <button key={label} onClick={() => set(!on)} style={{
                flex: 1, padding: "8px 0", borderRadius: 9,
                border: `1.5px solid ${on ? C.teal : C.border}`,
                background: on ? C.tealSoft : "transparent",
                color: on ? C.teal : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>{label}</button>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            ※ 안드로이드 정책상 최소 간격은 15분이며, 배터리 절약 상태에 따라 실제 실행은 다소 지연될 수 있습니다.
            실행 조건을 켜면 조건이 충족될 때까지 갱신이 미뤄집니다.
          </div>
        </div>

        <button onClick={onTest} style={{
          width: "100%", marginTop: 16, background: "transparent", border: `1px solid ${C.teal}`,
          borderRadius: 12, padding: 11, color: C.teal, fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>⚡ 지금 한 번 적용 테스트</button>

        <button onClick={save} style={{
          width: "100%", marginTop: 10, background: `linear-gradient(135deg,${C.accent},#7C3AED)`,
          border: "none", borderRadius: 12, padding: 12, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>저장</button>
      </div>
    </div>
  );
}
