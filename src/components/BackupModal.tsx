import { useId, useState } from "react";
import { Source, NotifSettings, BackupExtra, ToastMsg } from "../types";
import { C } from "../theme";
import { serializeBackup, parseBackup } from "../lib/backup";
import { Lbl, Sheet, outlineBtn, primaryBtn } from "./common";

// ─── 백업/복원 모달 ─────────────────────────────────────────────────────────────────
export function BackupModal({ sources, notif, activeId, onImport, onClose, toast }: {
  sources: Source[];
  notif: NotifSettings;
  activeId: string | null;
  onImport: (s: Source[], extra: BackupExtra) => void;
  onClose: () => void;
  toast: (m: string, t?: ToastMsg["type"]) => void;
}) {
  const exportText = serializeBackup(sources, notif, activeId);
  const [text, setText] = useState("");
  const outId = useId();
  const inId = useId();

  const copy = async () => {
    try { await navigator.clipboard.writeText(exportText); toast("클립보드에 복사했어요"); }
    catch { toast("복사하지 못했어요. 아래 내용을 직접 선택해 복사해 주세요", "warn"); }
  };
  const download = () => {
    try {
      const blob = new Blob([exportText], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `wallsync-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast("다운로드하지 못했어요", "error"); }
  };
  const doImport = () => {
    try {
      const { sources: valid, extra } = parseBackup(text);
      onImport(valid, extra);
      toast(`${valid.length}개를 가져왔어요 (덮어쓰기)`);
      onClose();
    } catch (e) {
      toast(`가져오지 못했어요: ${(e as Error).message}`, "error");
    }
  };

  const box: React.CSSProperties = {
    background: C.bg, border: `1.5px solid ${C.borderStrong}`, borderRadius: 12, padding: "12px 14px",
    color: C.text, fontSize: 13, width: "100%", boxSizing: "border-box", fontFamily: "monospace", resize: "vertical",
  };

  return (
    <Sheet title="백업 / 복원" onClose={onClose}>
      <div>
        <Lbl htmlFor={outId}>내보내기 ({sources.length}개)</Lbl>
        <textarea id={outId} readOnly value={exportText} rows={5} style={{ ...box, marginBottom: 10 }} onFocus={(e) => e.currentTarget.select()} />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={copy} style={{ ...primaryBtn(48), flex: 1, fontSize: 14 }}>클립보드 복사</button>
          <button type="button" onClick={download} style={{ ...outlineBtn(C.sub, C.borderStrong, 48), flex: 1 }}>파일 다운로드</button>
        </div>
      </div>

      <div>
        <Lbl htmlFor={inId}>가져오기 (붙여넣고 덮어쓰기)</Lbl>
        <textarea id={inId} value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder='[{"id":"...","url":"...","type":"kbo",...}]' style={{ ...box, marginBottom: 10 }} />
        <button type="button" onClick={doImport} disabled={!text.trim()} style={{
          ...outlineBtn(C.teal, C.teal, 48), width: "100%",
          ...(text.trim() ? {} : { color: C.muted, borderColor: C.disabledLine, cursor: "default" }),
        }}>가져오기 (현재 목록 덮어쓰기)</button>
      </div>
    </Sheet>
  );
}
