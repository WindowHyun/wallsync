import { useId, useState } from "react";
import { Source, KboConfig } from "../types";
import { WallpaperTarget } from "../wallpaper";
import { C } from "../theme";
import { TEAMS, STYLES, MODES, RES, buildKboUrl } from "../lib/kbo";
import { uid } from "../lib/uid";
import { validateImageUrl } from "../lib/url";
import { Icon, Lbl, Select, Sheet, Tabs, TargetPicker, TextField, Thumb, primaryBtn } from "./common";

// ─── 추가/편집 시트 ────────────────────────────────────────────────────────────────
export function Editor({ editing, onSubmit, onClose }: { editing: Source | null; onSubmit: (s: Source) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"kbo" | "url">(editing?.type ?? "kbo");
  const [name, setName] = useState(editing?.name ?? "");
  const [url, setUrl] = useState(editing && editing.type === "url" ? editing.url : "");
  const [target, setTarget] = useState<WallpaperTarget>(editing?.target ?? "both");
  const [kbo, setKbo] = useState<KboConfig>(editing?.kbo ?? { team: "KIA", style: "minimal", mode: "dark", res: "android-fhd" });
  const targetLabelId = useId();

  // 직접 URL은 검증을 통과한 값만 사용한다 (잘못된 값이 카드·자동 갱신으로 새어 들어가지 않게)
  const urlCheck = validateImageUrl(url);
  const urlError = tab === "url" && url.trim() && !urlCheck.ok ? urlCheck.error : null;
  const resolvedUrl = tab === "kbo" ? buildKboUrl(kbo) : urlCheck.ok ? urlCheck.url : "";
  // KBO 미리보기는 축소본(scale)으로 받아 전송량을 줄인다 (렌더 결과는 동일)
  const previewUrl = tab === "kbo" ? `${resolvedUrl}&scale=0.4` : resolvedUrl;
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

  return (
    <Sheet title={editing ? "배경화면 편집" : "배경화면 추가"} onClose={onClose}>
      <Tabs label="추가 방식" value={tab} onChange={setTab} options={[["kbo", "KBO 빌더"], ["url", "직접 URL"]]} />

      {tab === "kbo" ? (
        <>
          <div style={{ display: "flex", gap: 12 }}>
            <Select label="구단" value={kbo.team} onChange={(v) => setKbo({ ...kbo, team: v })} options={TEAMS} />
            <Select label="스타일" value={kbo.style} onChange={(v) => setKbo({ ...kbo, style: v })} options={STYLES} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Select label="모드" value={kbo.mode} onChange={(v) => setKbo({ ...kbo, mode: v })} options={MODES} />
            <Select label="해상도" value={kbo.res} onChange={(v) => setKbo({ ...kbo, res: v })} options={RES} flex={1.4} />
          </div>
        </>
      ) : (
        <TextField label="이미지 URL" type="url" value={url} onChange={setUrl} placeholder="https://example.com/image.png" error={urlError} />
      )}

      <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
        {resolvedUrl ? (
          <Thumb src={previewUrl} width={90} height={160} alt="미리보기" />
        ) : (
          <div style={{ flexShrink: 0, width: 90, height: 160, boxSizing: "border-box", borderRadius: 12, background: C.bg, border: `1.5px dashed ${C.borderStrong}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: C.muted }}>
            <Icon name="image" size={26} stroke={1.6} />
            <span style={{ fontSize: 12, lineHeight: 1.3, textAlign: "center" }}>미리보기<br />대기 중</span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.sub }}>{tab === "kbo" ? "미리보기" : "이런 주소를 쓸 수 있어요"}</div>
          {tab === "kbo" ? (
            <div style={{ padding: 12, borderRadius: 12, background: C.tealWash, border: `1px solid ${C.tealLine}`, fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ color: C.teal, fontWeight: 700 }}>매일 최신 결과 · 매달 새 달력</span>으로 자동 갱신돼요. 연·월은 따로 지정하지 않아요.
            </div>
          ) : (
            <div style={{ fontSize: 13, lineHeight: 1.6, color: C.muted }}>
              http:// 또는 https://로 시작하는 이미지 주소<br />(png · jpg · webp)<br />
              KBO 월페이퍼는 <span style={{ color: C.accentText, fontWeight: 700 }}>KBO 빌더</span> 탭에서 만들 수 있어요.
            </div>
          )}
        </div>
      </div>

      <TextField label="이름" optional value={name} onChange={setName} placeholder={defaultName} />

      <div>
        <Lbl id={targetLabelId}>적용 대상</Lbl>
        <TargetPicker value={target} onChange={setTarget} labelledBy={targetLabelId} height={48} />
      </div>

      <button type="button" onClick={submit} disabled={!resolvedUrl} style={{
        ...primaryBtn(52), marginTop: 4,
        ...(resolvedUrl ? {} : { background: C.disabledBg, border: `1.5px solid ${C.disabledLine}`, color: C.muted, cursor: "default" }),
      }}>{editing ? "저장" : "추가하기"}</button>
    </Sheet>
  );
}
