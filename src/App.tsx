import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Wallpaper, WallpaperTarget, SyncResult } from "./wallpaper";
import { scheduleGameNotifications, cancelGameNotifications } from "./notifications";

// ─── 테마 ──────────────────────────────────────────────────────────────────────
const C = {
  bg: "#08080F", surface: "#111118", card: "#18181F", cardHover: "#1E1E28",
  border: "#26263A", accent: "#5B4FE8", accentSoft: "rgba(91,79,232,0.18)",
  teal: "#00C9A7", tealSoft: "rgba(0,201,167,0.15)",
  text: "#EEEEF5", sub: "#9898B8", muted: "#55557A",
  success: "#22C55E", error: "#EF4444", warn: "#F59E0B",
};

const KBO_BASE = "https://kbo-wallpaper.vercel.app/api/wallpaper";

// 구단별 대표색 (다크 배경에서 잘 보이도록 보정)
const TEAM_COLORS: Record<string, string> = {
  KIA: "#E4002B", SAMSUNG: "#2E6CC4", LG: "#D6004E", DOOSAN: "#3A4D8F",
  SSG: "#E81E33", LOTTE: "#2D5BA8", HANWHA: "#FF7A1A", NC: "#3D6CB0",
  KIWOOM: "#A8324E", KT: "#5A6270",
};

// ─── 타입 ──────────────────────────────────────────────────────────────────────
type Schedule =
  | { kind: "interval"; hours: number }
  | { kind: "daily"; hour: number; minute: number };

interface KboConfig { team: string; style: string; mode: string; res: string }

interface Source {
  id: string;
  name: string;
  type: "url" | "kbo";
  url: string;
  target: WallpaperTarget;
  kbo?: KboConfig;
  auto: boolean;
  schedule: Schedule | null;
  addedAt: number;
  lastApplied: number | null;
}

const teamColor = (s: Source) =>
  (s.type === "kbo" && s.kbo && TEAM_COLORS[s.kbo.team]) || C.accent;

// ─── KBO 빌더 옵션 ───────────────────────────────────────────────────────────────
const TEAMS = [
  ["KIA", "KIA 타이거즈"], ["SAMSUNG", "삼성 라이온즈"], ["LG", "LG 트윈스"],
  ["DOOSAN", "두산 베어스"], ["SSG", "SSG 랜더스"], ["LOTTE", "롯데 자이언츠"],
  ["HANWHA", "한화 이글스"], ["NC", "NC 다이노스"], ["KIWOOM", "키움 히어로즈"], ["KT", "KT 위즈"],
];
const STYLES = [
  ["minimal", "미니멀"], ["mascot", "마스코트"], ["brutal", "브루탈"], ["nighter", "나이터"],
  ["sketch", "스케치"], ["newspaper", "신문"], ["bento", "벤토"], ["kpop-card", "K-POP 카드"],
  ["led-scoreboard", "전광판"], ["grass", "잔디"], ["dots", "도트"], ["diamond", "다이아몬드"], ["list", "리스트"],
];
const MODES = [["dark", "다크"], ["light", "라이트"]];
const RES = [
  ["android-fhd", "안드로이드 FHD (1080×2400)"], ["android-qhd", "안드로이드 QHD (1440×3120)"],
  ["iphone-15-pro", "아이폰 15 Pro"], ["iphone-15-pro-max", "아이폰 15 Pro Max"],
  ["iphone-17", "아이폰 17"], ["iphone-17-pro-max", "아이폰 17 Pro Max"], ["iphone-se", "아이폰 SE"],
];

const buildKboUrl = (k: KboConfig) =>
  `${KBO_BASE}?team=${encodeURIComponent(k.team)}&style=${k.style}&mode=${k.mode}&res=${k.res}`;

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 9);
const native = Capacitor.isNativePlatform();

function rel(ts: number) {
  const d = Date.now() - ts;
  if (d < 60000) return "방금 전";
  if (d < 3600000) return `${Math.floor(d / 60000)}분 전`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}시간 전`;
  return `${Math.floor(d / 86400000)}일 전`;
}
const appliedLabel = (ts: number | null) => (ts ? `${rel(ts)} 적용` : "미적용");
const targetLabel = (t: WallpaperTarget) => (t === "home" ? "홈" : t === "lock" ? "잠금" : "홈+잠금");

function scheduleLabel(s: Schedule | null) {
  if (!s) return "";
  if (s.kind === "interval") return `${s.hours}시간마다`;
  return `매일 ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
}

// 네이티브 예약 등록 (interval/daily). daily는 네이티브가 매 실행마다 다음 정시를
// 스스로 재예약하므로 시각이 드리프트되지 않는다.
function scheduleNative(id: string, url: string, target: WallpaperTarget, s: Schedule) {
  if (s.kind === "interval") {
    return Wallpaper.schedule({ id, url, target, mode: "interval", intervalMinutes: s.hours * 60 });
  }
  return Wallpaper.schedule({ id, url, target, mode: "daily", dailyHour: s.hour, dailyMinute: s.minute });
}

// 자동 갱신 마지막 결과 라벨
function syncLabel(r: SyncResult | undefined): { text: string; color: string } | null {
  if (!r) return null;
  if (r.ok) return { text: `자동 갱신 ✓ ${rel(r.time)}`, color: C.success };
  return { text: "자동 갱신 ✗ 실패", color: C.error };
}

const STORE_KEY = "wallsync.sources.v1";
const ACTIVE_KEY = "wallsync.active.v1";
const NOTIF_KEY = "wallsync.notif.v1";

interface NotifSettings { enabled: boolean; team: string; lead: number }
const leadLabel = (m: number) => (m < 60 ? `${m}분` : m % 60 === 0 ? `${m / 60}시간` : `${Math.floor(m / 60)}시간 ${m % 60}분`);

interface ToastAction { label: string; fn: () => void }
interface ToastMsg { id: string; msg: string; type: "success" | "error" | "warn"; action?: ToastAction }

const ghostMini: React.CSSProperties = {
  flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${C.border}`,
  background: "transparent", color: C.sub, fontSize: 11, fontWeight: 600, cursor: "pointer",
};

// ─── 작은 컴포넌트 ────────────────────────────────────────────────────────────────
function Lbl({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, color: C.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>{children}</label>;
}

function TargetPicker({ value, onChange }: { value: WallpaperTarget; onChange: (t: WallpaperTarget) => void }) {
  const opts: [WallpaperTarget, string][] = [["home", "홈"], ["lock", "잠금"], ["both", "둘 다"]];
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {opts.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          flex: 1, padding: "7px 0", borderRadius: 8,
          border: `1.5px solid ${value === v ? C.accent : C.border}`,
          background: value === v ? C.accentSoft : "transparent",
          color: value === v ? C.text : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>{l}</button>
      ))}
    </div>
  );
}

// ─── 추가/편집 모달 ────────────────────────────────────────────────────────────────
function Editor({ editing, onSubmit, onClose }: { editing: Source | null; onSubmit: (s: Source) => void; onClose: () => void }) {
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
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 20 }}>✕</button>
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

// ─── 예약 모달 ────────────────────────────────────────────────────────────────────
function ScheduleModal({ src, onSave, onTest, onClose }: { src: Source; onSave: (auto: boolean, s: Schedule | null) => void; onTest: () => void; onClose: () => void }) {
  const [enabled, setEnabled] = useState(src.auto);
  const [kind, setKind] = useState<"interval" | "daily">(src.schedule?.kind ?? "interval");
  const [hours, setHours] = useState(src.schedule?.kind === "interval" ? src.schedule.hours : 6);
  const [hour, setHour] = useState(src.schedule?.kind === "daily" ? src.schedule.hour : 8);
  const [minute, setMinute] = useState(src.schedule?.kind === "daily" ? src.schedule.minute : 0);

  const save = () => {
    if (!enabled) { onSave(false, null); onClose(); return; }
    const s: Schedule = kind === "interval" ? { kind, hours } : { kind: "daily", hour, minute };
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
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 18 }}>✕</button>
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
                {[0, 10, 15, 20, 30, 45].map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}분</option>)}
              </select>
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            ※ 안드로이드 정책상 최소 간격은 15분이며, 배터리 절약 상태에 따라 실제 실행은 다소 지연될 수 있습니다.
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

// ─── 경기 알림 모달 ────────────────────────────────────────────────────────────────
function NotifModal({ settings, onSave, onClose }: { settings: NotifSettings; onSave: (s: NotifSettings) => void; onClose: () => void }) {
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
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 18 }}>✕</button>
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

// ─── 백업/복원 모달 ─────────────────────────────────────────────────────────────────
function BackupModal({ sources, onImport, onClose, toast }: {
  sources: Source[];
  onImport: (s: Source[]) => void;
  onClose: () => void;
  toast: (m: string, t?: ToastMsg["type"]) => void;
}) {
  const exportText = JSON.stringify(sources, null, 2);
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
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("배열 형식이 아닙니다");
      const valid = parsed.filter((x) => x && typeof x.id === "string" && typeof x.url === "string" && (x.type === "kbo" || x.type === "url"));
      if (valid.length === 0) throw new Error("유효한 항목이 없습니다");
      onImport(valid as Source[]);
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
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: 20 }}>✕</button>
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

// ─── 카드 ──────────────────────────────────────────────────────────────────────
function SourceCard({ src, sync, active, onApply, onTarget, onSchedule, onEdit, onCopy, onDelete }: {
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
  const accent = teamColor(src);
  const sl = syncLabel(sync);
  const [bust, setBust] = useState(0);
  const [imgLoading, setImgLoading] = useState(true);
  const displaySrc = bust ? src.url + (src.url.includes("?") ? "&" : "?") + "_t=" + bust : src.url;
  const refresh = () => { setImgLoading(true); setBust(Date.now()); };
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
        {active && <div style={{ position: "absolute", top: 8, left: 48, background: accent, borderRadius: 6, padding: "2px 8px", fontSize: 9, fontWeight: 800, color: "#fff" }}>✓ 적용중</div>}
        {src.auto && (
          <div style={{ position: "absolute", top: 8, right: 8, background: C.tealSoft, border: `1px solid ${C.teal}`, borderRadius: 6, padding: "2px 7px", fontSize: 9, fontWeight: 700, color: C.teal }}>
            ⚡ {scheduleLabel(src.schedule)}
          </div>
        )}
        <button onClick={refresh} title="미리보기 새로고침" style={{ position: "absolute", bottom: 8, left: 8, width: 28, height: 28, borderRadius: 8, background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", fontSize: 13 }}>↻</button>
        <button onClick={() => onDelete(src)} title="삭제" style={{ position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderRadius: 8, background: "rgba(0,0,0,0.6)", border: "none", color: C.error, cursor: "pointer", fontSize: 12 }}>✕</button>
      </div>

      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ color: C.text, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src.name}</div>
        <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{appliedLabel(src.lastApplied)}</div>
        {sl && <div style={{ color: sl.color, fontSize: 10, marginTop: 2 }} title={sync && !sync.ok ? sync.error : undefined}>{sl.text}</div>}

        <div style={{ margin: "8px 0" }}><TargetPicker value={src.target} onChange={(t) => onTarget(src.id, t)} /></div>

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onApply(src)} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "none", background: accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>지금 적용</button>
          <button onClick={() => onSchedule(src)} title="자동 갱신" style={{ padding: "8px 11px", borderRadius: 9, border: `1px solid ${src.auto ? C.teal : C.border}`, background: src.auto ? C.tealSoft : "transparent", color: src.auto ? C.teal : C.sub, fontSize: 12, cursor: "pointer" }}>⏰</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button onClick={() => onEdit(src)} style={ghostMini}>✎ 편집</button>
          <button onClick={() => onCopy(src)} style={ghostMini}>⧉ URL</button>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [sources, setSources] = useState<Source[]>([]);
  const [editor, setEditor] = useState<{ editing: Source | null } | null>(null);
  const [showBackup, setShowBackup] = useState(false);
  const [schedFor, setSchedFor] = useState<Source | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [battOk, setBattOk] = useState<boolean | null>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, SyncResult>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [notif, setNotif] = useState<NotifSettings>({ enabled: false, team: "KIA", lead: 60 });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setSources(JSON.parse(raw));
      setActiveId(localStorage.getItem(ACTIVE_KEY));
      const n = localStorage.getItem(NOTIF_KEY);
      if (n) setNotif(JSON.parse(n));
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  // 앱을 열 때 알림이 켜져 있으면 다가오는 경기로 다시 예약
  useEffect(() => {
    if (loaded && native && notif.enabled) {
      scheduleGameNotifications(notif.team, notif.lead).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // 자동 갱신 결과 이력 조회 (앱 진입/포그라운드 복귀 시)
  const refreshSync = useCallback(async () => {
    if (!native) return;
    try {
      const r = await Wallpaper.getSyncStatus();
      const map: Record<string, SyncResult> = {};
      for (const x of r.results) map[x.id] = x;
      setSyncStatus(map);
    } catch { /* ignore */ }
  }, []);

  // 배터리 최적화 예외 상태 확인
  const checkBattery = useCallback(async () => {
    if (!native) return;
    try { const r = await Wallpaper.isIgnoringBatteryOptimizations(); setBattOk(r.ignoring); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshSync(); checkBattery();
    const onVis = () => { if (document.visibilityState === "visible") { refreshSync(); checkBattery(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshSync, checkBattery]);

  useEffect(() => { if (loaded) localStorage.setItem(STORE_KEY, JSON.stringify(sources)); }, [sources, loaded]);
  useEffect(() => { if (loaded) { if (activeId) localStorage.setItem(ACTIVE_KEY, activeId); else localStorage.removeItem(ACTIVE_KEY); } }, [activeId, loaded]);

  const saveNotif = async (next: NotifSettings) => {
    setNotif(next);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
    if (!native) { toast("알림은 설치된 앱에서만 동작합니다", "warn"); return; }
    try {
      if (next.enabled) {
        const n = await scheduleGameNotifications(next.team, next.lead);
        toast(n > 0 ? `🔔 경기 알림 ${n}건 예약됨` : "다가오는 경기가 없습니다", n > 0 ? "success" : "warn");
      } else {
        await cancelGameNotifications();
        toast("경기 알림 해제됨", "warn");
      }
    } catch (e) { toast((e as Error).message || "알림 예약 실패", "error"); }
  };

  const toast = useCallback((msg: string, type: ToastMsg["type"] = "success", action?: ToastAction) => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, type, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 5000 : 3200);
  }, []);

  const handleApply = async (s: Source) => {
    if (!native) { toast("실제 적용은 설치된 앱에서만 동작합니다", "warn"); return; }
    try {
      await Wallpaper.apply({ url: s.url, target: s.target });
      setSources((p) => p.map((x) => (x.id === s.id ? { ...x, lastApplied: Date.now() } : x)));
      setActiveId(s.id);
      toast("✓ 배경화면 적용됨");
    } catch (e) { toast((e as Error).message || "적용 실패", "error"); }
  };

  const handleTarget = async (id: string, target: WallpaperTarget) => {
    setSources((p) => p.map((x) => (x.id === id ? { ...x, target } : x)));
    // 자동 갱신이 켜진 소스라면 백그라운드 작업도 새 대상으로 재등록 (표시값=실제동작 일치)
    const s = sources.find((x) => x.id === id);
    if (native && s && s.auto && s.schedule) {
      try { await scheduleNative(id, s.url, target, s.schedule); } catch { /* ignore */ }
    }
  };

  const handleEditorSubmit = async (s: Source) => {
    const isEdit = !!sources.find((x) => x.id === s.id);
    setSources((p) => (isEdit ? p.map((x) => (x.id === s.id ? s : x)) : [s, ...p]));
    if (isEdit) {
      if (native && s.auto && s.schedule) { try { await scheduleNative(s.id, s.url, s.target, s.schedule); } catch { /* ignore */ } }
      toast(`✓ "${s.name}" 수정됨`);
    } else {
      toast(`✓ "${s.name}" 추가됨`);
    }
  };

  const handleSchedSave = async (id: string, auto: boolean, schedule: Schedule | null) => {
    const s = sources.find((x) => x.id === id);
    if (!s) return;
    setSources((p) => p.map((x) => (x.id === id ? { ...x, auto, schedule } : x)));
    if (!native) { toast("예약은 설치된 앱에서만 동작합니다", "warn"); return; }
    try {
      if (auto && schedule) {
        await scheduleNative(id, s.url, s.target, schedule);
        try { await Wallpaper.requestNotificationPermission(); } catch { /* ignore */ }
        toast("⏰ 자동 갱신 예약됨");
      } else {
        await Wallpaper.cancel({ id });
        toast("자동 갱신 해제됨", "warn");
      }
      refreshSync();
    } catch (e) { toast((e as Error).message || "예약 실패", "error"); }
  };

  const handleCopy = async (s: Source) => {
    try { await navigator.clipboard.writeText(s.url); toast("URL 복사됨"); }
    catch { toast("복사 실패 — 길게 눌러 직접 복사하세요", "warn"); }
  };

  // 복원: 기존 예약을 모두 취소하고 가져온 목록으로 교체, 자동 소스는 재예약
  const handleImport = async (imported: Source[]) => {
    if (native) {
      try {
        for (const old of sources) { try { await Wallpaper.cancel({ id: old.id }); } catch { /* ignore */ } }
        for (const s of imported) {
          if (s.auto && s.schedule) { try { await scheduleNative(s.id, s.url, s.target, s.schedule); } catch { /* ignore */ } }
        }
      } catch { /* ignore */ }
    }
    setSources(imported);
  };

  const handleDelete = (s: Source) => {
    setSources((p) => p.filter((x) => x.id !== s.id));
    if (activeId === s.id) setActiveId(null);
    if (native) { Wallpaper.cancel({ id: s.id }).catch(() => {}); }
    toast(`"${s.name}" 삭제됨`, "warn", {
      label: "실행취소",
      fn: () => {
        setSources((p) => (p.find((x) => x.id === s.id) ? p : [s, ...p]));
        if (native && s.auto && s.schedule) { scheduleNative(s.id, s.url, s.target, s.schedule).catch(() => {}); }
      },
    });
  };

  const autoCount = sources.filter((s) => s.auto).length;
  const activeSrc = sources.find((s) => s.id === activeId) || null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Segoe UI',-apple-system,'Noto Sans KR',sans-serif" }}>
      <style>{`
        @keyframes toastIn { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        *{box-sizing:border-box} input,select{font-family:inherit} input::placeholder{color:${C.muted}}
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
      `}</style>

      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 999, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: t.type === "error" ? C.error : t.type === "warn" ? C.warn : C.success,
            color: t.type === "warn" ? "#000" : "#fff", borderRadius: 10, padding: "10px 14px",
            fontSize: 13, fontWeight: 600, boxShadow: "0 8px 28px rgba(0,0,0,0.5)", animation: "toastIn 0.25s ease", maxWidth: 320,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span>{t.msg}</span>
            {t.action && (
              <button onClick={() => { t.action!.fn(); setToasts((p) => p.filter((x) => x.id !== t.id)); }}
                style={{ background: "rgba(0,0,0,0.18)", border: "none", borderRadius: 7, padding: "4px 10px", color: "inherit", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>

      {editor && <Editor editing={editor.editing} onSubmit={handleEditorSubmit} onClose={() => setEditor(null)} />}
      {showNotif && <NotifModal settings={notif} onSave={saveNotif} onClose={() => setShowNotif(false)} />}
      {showBackup && <BackupModal sources={sources} onImport={handleImport} onClose={() => setShowBackup(false)} toast={toast} />}
      {schedFor && <ScheduleModal src={schedFor} onSave={(auto, s) => handleSchedSave(schedFor.id, auto, s)} onTest={() => handleApply(schedFor)} onClose={() => setSchedFor(null)} />}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 18px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "-0.5px", background: `linear-gradient(90deg,${C.accent},#A78BFA)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🖼️ WallSync</h1>
            <p style={{ margin: "3px 0 0", color: C.sub, fontSize: 12 }}>URL·KBO 배경화면 자동 갱신</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {autoCount > 0 && <div style={{ padding: "6px 12px", borderRadius: 10, background: C.tealSoft, border: `1px solid ${C.teal}`, color: C.teal, fontSize: 12, fontWeight: 700 }}>⚡ {autoCount}개 자동</div>}
            <button onClick={() => setShowNotif(true)} title="경기 알림" style={{ background: notif.enabled ? C.tealSoft : "transparent", border: `1px solid ${notif.enabled ? C.teal : C.border}`, borderRadius: 11, padding: "9px 12px", color: notif.enabled ? C.teal : C.sub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🔔</button>
            {sources.length > 0 && <button onClick={() => setShowBackup(true)} title="백업 / 복원" style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 11, padding: "9px 14px", color: C.sub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>⤓ 백업</button>}
            <button onClick={() => setEditor({ editing: null })} style={{ background: `linear-gradient(135deg,${C.accent},#7C3AED)`, border: "none", borderRadius: 11, padding: "9px 18px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ 추가</button>
          </div>
        </div>

        {!native && (
          <div style={{ margin: "12px 0 4px", padding: "10px 14px", borderRadius: 10, background: C.warn, color: "#000", fontSize: 12, fontWeight: 600 }}>
            ⚠️ 미리보기(웹) 모드입니다. 실제 배경화면 적용·자동 갱신은 안드로이드 기기에 설치한 WallSync 앱에서만 동작합니다.
          </div>
        )}

        {native && battOk === false && (
          <div style={{ margin: "12px 0 4px", padding: "12px 14px", borderRadius: 12, background: "rgba(245,158,11,0.12)", border: `1px solid ${C.warn}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.warn, marginBottom: 4 }}>🔋 배터리 최적화 해제 필요</div>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5, marginBottom: 10 }}>
              최적화가 켜져 있으면 백그라운드 자동 갱신이 끊길 수 있습니다. 한 번만 해제하면 안정적으로 동작합니다.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => { try { await Wallpaper.requestIgnoreBatteryOptimizations(); } catch { /* */ } }}
                style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: C.warn, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>해제하기</button>
              <button onClick={async () => { try { await Wallpaper.openBatterySettings(); } catch { /* */ } }}
                style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>수동 설정</button>
            </div>
          </div>
        )}

        {native && battOk === true && (
          <div style={{ margin: "12px 0 4px", padding: "8px 12px", borderRadius: 10, background: C.tealSoft, border: `1px solid ${C.teal}`, color: C.teal, fontSize: 11, fontWeight: 600 }}>
            ✓ 배터리 최적화 해제됨 — 백그라운드 자동 갱신 안정 동작
          </div>
        )}

        {/* 현재 적용 중 */}
        {activeSrc && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "14px 0 4px", padding: 12, borderRadius: 14, background: C.surface, border: `1px solid ${teamColor(activeSrc)}55` }}>
            <img src={activeSrc.url} alt="" style={{ width: 46, height: 82, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}`, flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2"; }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, fontWeight: 700 }}>현재 적용 중</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: teamColor(activeSrc), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeSrc.name}</div>
              <div style={{ fontSize: 11, color: C.sub }}>{appliedLabel(activeSrc.lastApplied)} · {targetLabel(activeSrc.target)}</div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          {sources.length === 0 ? (
            <div style={{ textAlign: "center", padding: "70px 0", color: C.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🖼️</div>
              <div style={{ fontSize: 14 }}>등록된 배경화면이 없습니다</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>“+ 추가”를 눌러 KBO 배경화면을 등록해보세요</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
              {sources.map((s) => (
                <SourceCard key={s.id} src={s} sync={syncStatus[s.id]} active={s.id === activeId}
                  onApply={handleApply} onTarget={handleTarget} onSchedule={(x) => setSchedFor(x)}
                  onEdit={(x) => setEditor({ editing: x })} onCopy={handleCopy} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
