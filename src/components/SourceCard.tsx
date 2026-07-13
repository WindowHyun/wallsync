import { useState } from "react";
import { Source } from "../types";
import { WallpaperTarget, SyncResult } from "../wallpaper";
import { C, teamColor } from "../theme";
import { appliedLabel, scheduleLabel, syncLabel } from "../lib/format";
import { TargetPicker, ghostMini } from "./common";

// ─── 카드 ──────────────────────────────────────────────────────────────────────
export function SourceCard({ src, sync, activeOn, onApply, onTarget, onSchedule, onEdit, onCopy, onDelete }: {
  src: Source;
  sync?: SyncResult;
  /** 이 소스가 적용중인 화면 목록 (홈/잠금 별도 추적) */
  activeOn: ("home" | "lock")[];
  onApply: (s: Source) => void;
  onTarget: (id: string, t: WallpaperTarget) => void;
  onSchedule: (s: Source) => void;
  onEdit: (s: Source) => void;
  onCopy: (s: Source) => void;
  onDelete: (s: Source) => void;
}) {
  const accent = teamColor(src);
  const sl = syncLabel(sync);
  const [bust, setBust] = useState(0);
  const [imgLoading, setImgLoading] = useState(true);
  const displaySrc = bust ? src.url + (src.url.includes("?") ? "&" : "?") + "_t=" + bust : src.url;
  const refresh = () => { setImgLoading(true); setBust(Date.now()); };
  const active = activeOn.length > 0;
  const activeBadge = activeOn.length === 2 ? "✓ 적용중" : activeOn[0] === "home" ? "✓ 홈" : "✓ 잠금";
  const border = active ? accent : src.auto ? C.teal : "transparent";

  return (
    <div style={{ background: C.card, borderRadius: 16, overflow: "hidden", border: `1.5px solid ${border}`, boxShadow: active ? `0 8px 24px ${accent}44` : "none" }}>
      <div style={{ position: "relative", paddingTop: "150%", background: C.surface }}>
        <img key={displaySrc} src={displaySrc} alt={src.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          onLoad={(e) => { setImgLoading(false); (e.target as HTMLImageElement).style.opacity = "1"; }}
          onError={(e) => { setImgLoading(false); (e.target as HTMLImageElement).style.opacity = "0.2"; }} />
        {imgLoading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 11 }}>불러오는 중…</div>}

        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "2px 8px", fontSize: 9, fontWeight: 700, color: src.type === "kbo" ? accent : C.sub }}>
          {src.type === "kbo" ? "KBO" : "URL"}
        </div>
        {active && <div style={{ position: "absolute", top: 8, left: 48, background: accent, borderRadius: 6, padding: "2px 8px", fontSize: 9, fontWeight: 800, color: "#fff" }}>{activeBadge}</div>}
        {src.auto && (
          <div style={{ position: "absolute", top: 8, right: 8, background: C.tealSoft, border: `1px solid ${C.teal}`, borderRadius: 6, padding: "2px 7px", fontSize: 9, fontWeight: 700, color: C.teal }}>
            ⚡ {scheduleLabel(src.schedule)}
          </div>
        )}
        <button onClick={refresh} title="미리보기 새로고침" aria-label="미리보기 새로고침" style={{ position: "absolute", bottom: 8, left: 8, width: 28, height: 28, borderRadius: 8, background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", fontSize: 13 }}>↻</button>
        <button onClick={() => onDelete(src)} title="삭제" aria-label={`"${src.name}" 삭제`} style={{ position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderRadius: 8, background: "rgba(0,0,0,0.6)", border: "none", color: C.error, cursor: "pointer", fontSize: 12 }}>✕</button>
      </div>

      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ color: C.text, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src.name}</div>
        <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{appliedLabel(src.lastApplied)}</div>
        {sl && (
          <div style={{ color: sl.color, fontSize: 10, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sl.text}{sync && !sync.ok && sync.error ? ` · ${sync.error}` : ""}
          </div>
        )}

        <div style={{ margin: "8px 0" }}><TargetPicker value={src.target} onChange={(t) => onTarget(src.id, t)} /></div>

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onApply(src)} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "none", background: accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>지금 적용</button>
          <button onClick={() => onSchedule(src)} title="자동 갱신" aria-label="자동 갱신 설정" style={{ padding: "8px 11px", borderRadius: 9, border: `1px solid ${src.auto ? C.teal : C.border}`, background: src.auto ? C.tealSoft : "transparent", color: src.auto ? C.teal : C.sub, fontSize: 12, cursor: "pointer" }}>⏰</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button onClick={() => onEdit(src)} style={ghostMini}>✎ 편집</button>
          <button onClick={() => onCopy(src)} style={ghostMini}>⧉ URL</button>
        </div>
      </div>
    </div>
  );
}
