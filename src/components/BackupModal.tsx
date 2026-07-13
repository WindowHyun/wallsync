import { useState } from "react";
import { Source, NotifSettings, BackupExtra, ActiveMap, ToastMsg } from "../types";
import { C } from "../theme";
import { serializeBackup, parseBackup } from "../lib/backup";
import { Lbl } from "./common";

// ─── 백업/복원 모달 ─────────────────────────────────────────────────────────────────
export function BackupModal({ sources, notif, active, onImport, onClose, toast }: {
  sources: Source[];
  notif: NotifSettings;
  active: ActiveMap;
  onImport: (s: Source[], extra: BackupExtra) => void;
  onClose: () => void;
  toast: (m: string, t?: ToastMsg["type"]) => void;
}) {
  const exportText = serializeBackup(sources, notif, active);
  const [text, setText] = useState("");

  const copy = async () => {
    try { await navigator.clipboard.writeText(exportText); toast("✓ 클립보드에 복사됨"); }
    catch { toast("복사 실패 — 아래 내용을 직접 선택해 복사하세요", "warn"); }
  };
  const download = () => {
    try {
      const blob = new Blob([exportText], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `wallsync-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast("다운로드 실패", "error"); }
  };
  const doImport = () => {
    try {
      const { sources: valid, extra } = parseBackup(text);
      onImport(valid, extra);
      toast(`✓ ${valid.length}개 가져옴 (덮어쓰기)`);
      onClose();
    } catch (e) {
      toast(`가져오기 실패: ${(e as Error).message}`, "error");
    }
  };

  const box: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 12px",
    color: C.text, fontSize: 12, width: "100%", fontFamily: "monospace", resize: "vertical",
  };
  const btn = (bg: string, fg: string): React.CSSProperties => ({
    flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: bg, color: fg, fontSize: 12, fontWeight: 700, cursor: "pointer",
  });

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{ background: C.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 460, border: `1px solid ${C.border}`, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>⤓ 백업 / 복원</h3>
          <button onClick={onClose} aria-label="닫기" style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        <Lbl>내보내기 ({sources.length}개)</Lbl>
        <textarea readOnly value={exportText} rows={5} style={{ ...box, marginBottom: 8 }} onFocus={(e) => e.currentTarget.select()} />
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <button onClick={copy} style={btn(C.accent, "white")}>클립보드 복사</button>
          <button onClick={download} style={btn("transparent", C.sub)}>파일 다운로드</button>
        </div>

        <Lbl>가져오기 (붙여넣기 후 덮어쓰기)</Lbl>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder='[{"id":"...","url":"...","type":"kbo",...}]' style={{ ...box, marginBottom: 8 }} />
        <button onClick={doImport} disabled={!text.trim()} style={{ ...btn(C.teal, "#003"), width: "100%", opacity: text.trim() ? 1 : 0.4 }}>가져오기 (현재 목록 덮어쓰기)</button>
      </div>
    </div>
  );
}
