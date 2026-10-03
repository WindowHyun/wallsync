import { useState } from "react";
import { Source } from "../types";
import { WallpaperTarget, SyncResult } from "../wallpaper";
import { C } from "../theme";
import { appliedLabel, metaLabel, scheduleLabel, syncLabel } from "../lib/format";
import { Icon, IconName, ImgStatus, Sheet, TargetPicker, Thumb, iconBtn, outlineBtn, primaryBtn } from "./common";

// ─── 더보기 메뉴 (편집 · URL 복사 · 미리보기 새로고침 · 삭제) ─────────────────────────────
function MoreSheet({ src, onClose, onEdit, onCopy, onRefresh, onDelete }: {
  src: Source; onClose: () => void; onEdit: () => void; onCopy: () => void; onRefresh: () => void; onDelete: () => void;
}) {
  const row = (icon: IconName, label: string, fn: () => void, danger = false) => (
    <button type="button" onClick={() => { onClose(); fn(); }} style={{
      display: "flex", alignItems: "center", gap: 14, width: "100%", minHeight: 56, padding: "0 16px", borderRadius: 14,
      border: `1px solid ${C.border}`, background: C.card, color: danger ? C.error : C.text, fontFamily: "inherit",
      fontSize: 16, fontWeight: 600, cursor: "pointer", textAlign: "left",
    }}>
      <Icon name={icon} size={20} />{label}
    </button>
  );
  return (
    <Sheet title={src.name} subtitle="이 배경화면에 할 작업" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {row("edit", "편집", onEdit)}
        {row("copy", "URL 복사", onCopy)}
        {row("refresh", "미리보기 새로고침", onRefresh)}
        {row("trash", "삭제", onDelete, true)}
      </div>
    </Sheet>
  );
}

// ─── 카드 ──────────────────────────────────────────────────────────────────────
export function SourceCard({ src, sync, active, onApply, onTarget, onSchedule, onEdit, onCopy, onDelete }: {
  src: Source;
  sync?: SyncResult;
  active: boolean;
  onApply: (s: Source) => void;
  onTarget: (id: string, t: WallpaperTarget) => void;
  onSchedule: (s: Source) => void;
  onEdit: (s: Source) => void;
  onCopy: (s: Source) => void;
  onDelete: (s: Source) => void;
}) {
  const sl = syncLabel(sync);
  const [bust, setBust] = useState(0);
  const [imgStatus, setImgStatus] = useState<ImgStatus>("loading");
  const [menu, setMenu] = useState(false);
  const displaySrc = bust ? src.url + (src.url.includes("?") ? "&" : "?") + "_t=" + bust : src.url;
  const refresh = () => setBust(Date.now());
  const failed = imgStatus === "error";

  return (
    <article aria-label={src.name} style={{
      display: "flex", gap: 12, padding: 12, borderRadius: 18, background: C.card,
      border: `1.5px solid ${active ? C.activeLine : C.border}`,
    }}>
      <Thumb src={displaySrc} width={84} height={150} alt={`${src.name} 미리보기`} onStatus={setImgStatus} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 24 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src.name}</h2>
          {active && (
            <span style={{ flexShrink: 0, height: 24, padding: "0 8px", borderRadius: 12, background: C.accentSoft, color: C.accentText, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="check" size={12} stroke={3} />적용중
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{metaLabel(src)}</div>

        {failed ? (
          <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.error, fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
              <Icon name="alert" size={16} stroke={2} style={{ flexShrink: 0 }} />이미지를 불러오지 못했어요
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.4 }}>주소를 확인하거나 다시 시도해 주세요.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {src.auto && (
              <span style={{ alignSelf: "flex-start", height: 26, padding: "0 10px", borderRadius: 13, background: C.tealSoft, color: C.teal, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                <Icon name="clock" size={13} stroke={2.4} />{scheduleLabel(src.schedule)}
              </span>
            )}
            <div style={{ fontSize: 13, color: sl && !sl.ok ? sl.color : C.muted, lineHeight: 1.3, fontWeight: sl && !sl.ok ? 700 : 400 }}>
              {sl ? sl.text : appliedLabel(src.lastApplied)}
            </div>
          </div>
        )}

        <TargetPicker value={src.target} onChange={(t) => onTarget(src.id, t)} />

        <div style={{ display: "flex", gap: 6 }}>
          {failed ? (
            <button type="button" onClick={refresh} style={{ ...outlineBtn(), flex: 1, padding: 0 }}>
              <Icon name="refresh" size={18} />다시 시도
            </button>
          ) : (
            <button type="button" onClick={() => onApply(src)} style={{ ...primaryBtn(44), flex: 1, padding: 0 }}>지금 적용</button>
          )}
          <button type="button" onClick={() => onSchedule(src)} aria-label={src.auto ? "자동 갱신 설정 (켜짐)" : "자동 갱신 설정"} style={iconBtn(src.auto)}>
            <Icon name="clock" />
          </button>
          <button type="button" onClick={() => setMenu(true)} aria-label={`${src.name} 더보기`} aria-haspopup="dialog" style={iconBtn(false)}>
            <Icon name="more" />
          </button>
        </div>
      </div>

      {menu && (
        <MoreSheet src={src} onClose={() => setMenu(false)}
          onEdit={() => onEdit(src)} onCopy={() => onCopy(src)} onRefresh={refresh} onDelete={() => onDelete(src)} />
      )}
    </article>
  );
}
