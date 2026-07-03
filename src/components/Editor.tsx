import { useState } from "react";
import { Source, KboConfig } from "../types";
import { WallpaperTarget } from "../wallpaper";
import { C } from "../theme";
import { TEAMS, STYLES, MODES, RES, buildKboUrl } from "../lib/kbo";
import { uid } from "../lib/uid";
import { Lbl, TargetPicker } from "./common";

// ─── 추가/편집 모달 ────────────────────────────────────────────────────────────────
export function Editor({ editing, onSubmit, onClose }: { editing: Source | null; onSubmit: (s: Source) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"kbo" | "url">(editing?.type ?? "kbo");
  const [name, setName] = useState(editing?.name ?? "");
  const [url, setUrl] = useState(editing && editing.type === "url" ? editing.url : "");
  const [target, setTarget] = useState<WallpaperTarget>(editing?.target ?? "both");
  const [kbo, setKbo] = useState<KboConfig>(editing?.kbo ?? { team: "KIA", style: "minimal", mode: "dark", res: "android-fhd" });

  const resolvedUrl = tab === "kbo" ? buildKboUrl(kbo) : url.trim();
  const teamLabelTxt = TEAMS.find((t) => t[0] === kbo.team)?.[1] ?? kbo.team;
  const defaultName = tab === "kbo" ? teamLabelTxt : "내 배경화면";

  const submit = () => {
    if (!resolvedUrl) return;
    if (editing) {
      onSubmit({ ...editing, name: name.trim() || defaultName, type: tab, url: resolvedUrl, target, kbo: tab === "kbo" ? kbo : undefined });
    } else {
      onSubmit({
        id: uid(), name: name.trim() || defaultName, type: tab, url: resolvedUrl, target,
        kbo: tab === "kbo" ? kbo : undefined, auto: false, schedule: null, addedAt: Date.now(), lastApplied: null,
      });
    }
    onClose();
  };

  const sel = (value: string, onChange: (v: string) => void, opts: string[][]) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9,
      padding: "9px 10px", color: C.text, fontSize: 13, width: "100%",
    }}>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{ background: C.card, borderRadius: 22, padding: 24, width: "100%", maxWidth: 460, border: `1px solid ${C.border}`, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{editing ? "배경화면 편집" : "배경화면 추가"}</h3>
          <button onClick={onClose} aria-label="닫기" style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 18, background: C.surface, borderRadius: 12, padding: 4 }}>
          {[["kbo", "⚾ KBO 빌더"], ["url", "🔗 직접 URL"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k as "kbo" | "url")} style={{
              flex: 1, padding: "9px 4px", borderRadius: 9,
              background: tab === k ? C.card : "transparent",
              border: tab === k ? `1px solid ${C.border}` : "1px solid transparent",
              color: tab === k ? C.text : C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>{l}</button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tab === "kbo" ? (
            <>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}><Lbl>구단</Lbl>{sel(kbo.team, (v) => setKbo({ ...kbo, team: v }), TEAMS)}</div>
                <div style={{ flex: 1 }}><Lbl>스타일</Lbl>{sel(kbo.style, (v) => setKbo({ ...kbo, style: v }), STYLES)}</div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}><Lbl>모드</Lbl>{sel(kbo.mode, (v) => setKbo({ ...kbo, mode: v }), MODES)}</div>
                <div style={{ flex: 1.4 }}><Lbl>해상도</Lbl>{sel(kbo.res, (v) => setKbo({ ...kbo, res: v }), RES)}</div>
              </div>
              <div style={{ fontSize: 11, color: C.muted, background: C.surface, borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 }}>
                💡 연·월이 없는 URL이라 <b style={{ color: C.teal }}>매일 최신 결과·매달 새 달력</b>으로 자동 갱신됩니다.
              </div>
            </>
          ) : (
            <div>
              <Lbl>이미지 URL *</Lbl>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/image.png"
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 12px", color: C.text, fontSize: 13, width: "100%" }} />
            </div>
          )}

          <div><Lbl>이름</Lbl>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 12px", color: C.text, fontSize: 13, width: "100%" }} />
          </div>

          <div><Lbl>적용 대상</Lbl><TargetPicker value={target} onChange={setTarget} /></div>

          {resolvedUrl && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <img src={resolvedUrl} alt="preview" style={{ width: 120, height: 213, objectFit: "cover", borderRadius: 14, border: `1px solid ${C.border}`, background: C.surface }}
                onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "1"; }}
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.25"; }} />
            </div>
          )}
        </div>

        <button onClick={submit} disabled={!resolvedUrl} style={{
          width: "100%", marginTop: 18, opacity: resolvedUrl ? 1 : 0.4,
          background: `linear-gradient(135deg,${C.accent},#7C3AED)`, border: "none",
          borderRadius: 13, padding: 13, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>{editing ? "저장" : "+ 추가하기"}</button>
      </div>
    </div>
  );
}
