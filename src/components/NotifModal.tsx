import { useState } from "react";
import { NotifSettings } from "../types";
import { C } from "../theme";
import { TEAMS } from "../lib/kbo";
import { leadLabel } from "../lib/format";
import { Lbl } from "./common";

// ─── 경기 알림 모달 ────────────────────────────────────────────────────────────────
export function NotifModal({ settings, onSave, onClose }: { settings: NotifSettings; onSave: (s: NotifSettings) => void; onClose: () => void }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [team, setTeam] = useState(settings.team);
  const [lead, setLead] = useState(settings.lead);
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{ background: C.card, borderRadius: 20, padding: 26, width: "100%", maxWidth: 380, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>🔔 경기 알림</h3>
          <button onClick={onClose} aria-label="닫기" style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        <div onClick={() => setEnabled((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, cursor: "pointer" }}>
          <div style={{ width: 40, height: 22, borderRadius: 11, background: enabled ? C.accent : C.border, position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 3, left: enabled ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
          </div>
          <span style={{ fontSize: 14, color: enabled ? C.text : C.sub, fontWeight: 600 }}>경기 시작 전 알림 {enabled ? "켜짐" : "꺼짐"}</span>
        </div>

        <div style={{ opacity: enabled ? 1 : 0.4, pointerEvents: enabled ? "auto" : "none" }}>
          <Lbl>응원팀</Lbl>
          <select value={team} onChange={(e) => setTeam(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 10px", color: C.text, fontSize: 13, width: "100%", marginBottom: 14 }}>
            {TEAMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Lbl>알림 시점 (경기 시작 전)</Lbl>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[30, 60, 120, 180].map((m) => (
              <button key={m} onClick={() => setLead(m)} style={{
                padding: "7px 14px", borderRadius: 8,
                border: `1.5px solid ${lead === m ? C.accent : C.border}`,
                background: lead === m ? C.accentSoft : "transparent",
                color: lead === m ? C.text : C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>{leadLabel(m)}</button>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            ※ 앱을 열 때 다가오는 경기 기준으로 다시 예약됩니다. 일정 출처: KBO 공식.
          </div>
        </div>

        <button onClick={() => { onSave({ enabled, team, lead }); onClose(); }} style={{
          width: "100%", marginTop: 20, background: `linear-gradient(135deg,${C.accent},#7C3AED)`,
          border: "none", borderRadius: 12, padding: 12, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>저장</button>
      </div>
    </div>
  );
}
