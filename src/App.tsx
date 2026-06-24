import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Wallpaper, WallpaperTarget } from "./wallpaper";

// ─── 테마 ──────────────────────────────────────────────────────────────────────
const C = {
  bg: "#08080F", surface: "#111118", card: "#18181F", cardHover: "#1E1E28",
  border: "#26263A", accent: "#5B4FE8", accentSoft: "rgba(91,79,232,0.18)",
  teal: "#00C9A7", tealSoft: "rgba(0,201,167,0.15)",
  text: "#EEEEF5", sub: "#9898B8", muted: "#55557A",
  success: "#22C55E", error: "#EF4444", warn: "#F59E0B",
};

const KBO_BASE = "https://kbo-wallpaper.vercel.app/api/wallpaper";

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

function timeAgo(ts: number | null) {
  if (!ts) return "미적용";
  const d = Date.now() - ts;
  if (d < 60000) return "방금 전 적용";
  if (d < 3600000) return `${Math.floor(d / 60000)}분 전 적용`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}시간 전 적용`;
  return `${Math.floor(d / 86400000)}일 전 적용`;
}

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

const STORE_KEY = "wallsync.sources.v1";

interface ToastMsg { id: string; msg: string; type: "success" | "error" | "warn" }

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

// ─── 추가 모달 ────────────────────────────────────────────────────────────────────
function AddModal({ onAdd, onClose }: { onAdd: (s: Source) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"kbo" | "url">("kbo");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState<WallpaperTarget>("both");
  const [kbo, setKbo] = useState<KboConfig>({ team: "KIA", style: "minimal", mode: "dark", res: "android-fhd" });

  const resolvedUrl = tab === "kbo" ? buildKboUrl(kbo) : url.trim();
  const teamLabel = TEAMS.find((t) => t[0] === kbo.team)?.[1] ?? kbo.team;
  const defaultName = tab === "kbo" ? teamLabel : "내 배경화면";

  const submit = () => {
    if (!resolvedUrl) return;
    onAdd({
      id: uid(), name: name.trim() || defaultName, type: tab, url: resolvedUrl, target,
      kbo: tab === "kbo" ? kbo : undefined, auto: false, schedule: null,
      addedAt: Date.now(), lastApplied: null,
    });
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
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>배경화면 추가</h3>
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
        }}>+ 추가하기</button>
      </div>
    </div>
  );
}

// ─── 예약 모달 ────────────────────────────────────────────────────────────────────
function ScheduleModal({ src, onSave, onClose }: { src: Source; onSave: (auto: boolean, s: Schedule | null) => void; onClose: () => void }) {
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

        <button onClick={save} style={{
          width: "100%", marginTop: 20, background: `linear-gradient(135deg,${C.accent},#7C3AED)`,
          border: "none", borderRadius: 12, padding: 12, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>저장</button>
      </div>
    </div>
  );
}

// ─── 카드 ──────────────────────────────────────────────────────────────────────
function SourceCard({ src, onApply, onTarget, onSchedule, onDelete }: {
  src: Source;
  onApply: (s: Source) => void;
  onTarget: (id: string, t: WallpaperTarget) => void;
  onSchedule: (s: Source) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ background: C.card, borderRadius: 16, overflow: "hidden", border: `1.5px solid ${src.auto ? C.teal : "transparent"}` }}>
      <div style={{ position: "relative", paddingTop: "150%", background: C.surface }}>
        <img src={src.url} alt={src.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "1"; }}
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2"; }} />
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "2px 8px", fontSize: 9, fontWeight: 700, color: src.type === "kbo" ? C.teal : C.sub }}>
          {src.type === "kbo" ? "KBO" : "URL"}
        </div>
        {src.auto && (
          <div style={{ position: "absolute", top: 8, right: 8, background: C.tealSoft, border: `1px solid ${C.teal}`, borderRadius: 6, padding: "2px 7px", fontSize: 9, fontWeight: 700, color: C.teal }}>
            ⚡ {scheduleLabel(src.schedule)}
          </div>
        )}
        <button onClick={() => onDelete(src.id)} style={{ position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderRadius: 8, background: "rgba(0,0,0,0.6)", border: "none", color: C.error, cursor: "pointer", fontSize: 12 }}>✕</button>
      </div>

      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ color: C.text, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src.name}</div>
        <div style={{ color: C.muted, fontSize: 10, marginTop: 2, marginBottom: 8 }}>{timeAgo(src.lastApplied)}</div>
        <div style={{ marginBottom: 8 }}><TargetPicker value={src.target} onChange={(t) => onTarget(src.id, t)} /></div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onApply(src)} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "none", background: C.accent, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>지금 적용</button>
          <button onClick={() => onSchedule(src)} title="자동 갱신" style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${src.auto ? C.teal : C.border}`, background: src.auto ? C.tealSoft : "transparent", color: src.auto ? C.teal : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⏰</button>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [sources, setSources] = useState<Source[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [schedFor, setSchedFor] = useState<Source | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [battOk, setBattOk] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setSources(JSON.parse(raw));
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  // 배터리 최적화 예외 상태 확인 (설정에서 돌아올 때마다 재확인)
  const checkBattery = useCallback(async () => {
    if (!native) return;
    try {
      const r = await Wallpaper.isIgnoringBatteryOptimizations();
      setBattOk(r.ignoring);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    checkBattery();
    const onVis = () => { if (document.visibilityState === "visible") checkBattery(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [checkBattery]);
  useEffect(() => {
    if (loaded) localStorage.setItem(STORE_KEY, JSON.stringify(sources));
  }, [sources, loaded]);

  const toast = useCallback((msg: string, type: ToastMsg["type"] = "success") => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const handleApply = async (s: Source) => {
    if (!native) { toast("실제 적용은 설치된 앱에서만 동작합니다", "warn"); return; }
    try {
      await Wallpaper.apply({ url: s.url, target: s.target });
      setSources((p) => p.map((x) => (x.id === s.id ? { ...x, lastApplied: Date.now() } : x)));
      toast("✓ 배경화면 적용됨");
    } catch (e) {
      toast((e as Error).message || "적용 실패", "error");
    }
  };

  const handleTarget = async (id: string, target: WallpaperTarget) => {
    setSources((p) => p.map((x) => (x.id === id ? { ...x, target } : x)));
    // 자동 갱신이 켜진 소스라면 백그라운드 작업도 새 대상으로 재등록 (표시값=실제동작 일치)
    const s = sources.find((x) => x.id === id);
    if (native && s && s.auto && s.schedule) {
      try {
        await scheduleNative(id, s.url, target, s.schedule);
      } catch { /* ignore */ }
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
        toast("⏰ 자동 갱신 예약됨");
      } else {
        await Wallpaper.cancel({ id });
        toast("자동 갱신 해제됨", "warn");
      }
    } catch (e) {
      toast((e as Error).message || "예약 실패", "error");
    }
  };

  const handleDelete = async (id: string) => {
    setSources((p) => p.filter((x) => x.id !== id));
    if (native) { try { await Wallpaper.cancel({ id }); } catch { /* ignore */ } }
    toast("삭제됨", "warn");
  };

  const autoCount = sources.filter((s) => s.auto).length;

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
            color: t.type === "warn" ? "#000" : "#fff", borderRadius: 10, padding: "10px 16px",
            fontSize: 13, fontWeight: 600, boxShadow: "0 8px 28px rgba(0,0,0,0.5)", animation: "toastIn 0.25s ease", maxWidth: 300,
          }}>{t.msg}</div>
        ))}
      </div>

      {showAdd && <AddModal onAdd={(s) => { setSources((p) => [s, ...p]); toast(`✓ "${s.name}" 추가됨`); }} onClose={() => setShowAdd(false)} />}
      {schedFor && <ScheduleModal src={schedFor} onSave={(auto, s) => handleSchedSave(schedFor.id, auto, s)} onClose={() => setSchedFor(null)} />}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 18px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "-0.5px", background: `linear-gradient(90deg,${C.accent},#A78BFA)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🖼️ WallSync</h1>
            <p style={{ margin: "3px 0 0", color: C.sub, fontSize: 12 }}>URL·KBO 배경화면 자동 갱신</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {autoCount > 0 && <div style={{ padding: "6px 12px", borderRadius: 10, background: C.tealSoft, border: `1px solid ${C.teal}`, color: C.teal, fontSize: 12, fontWeight: 700 }}>⚡ {autoCount}개 자동</div>}
            <button onClick={() => setShowAdd(true)} style={{ background: `linear-gradient(135deg,${C.accent},#7C3AED)`, border: "none", borderRadius: 11, padding: "9px 18px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ 추가</button>
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
                style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: C.warn, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                해제하기
              </button>
              <button onClick={async () => { try { await Wallpaper.openBatterySettings(); } catch { /* */ } }}
                style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                수동 설정
              </button>
            </div>
          </div>
        )}

        {native && battOk === true && (
          <div style={{ margin: "12px 0 4px", padding: "8px 12px", borderRadius: 10, background: C.tealSoft, border: `1px solid ${C.teal}`, color: C.teal, fontSize: 11, fontWeight: 600 }}>
            ✓ 배터리 최적화 해제됨 — 백그라운드 자동 갱신 안정 동작
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
                <SourceCard key={s.id} src={s} onApply={handleApply} onTarget={handleTarget} onSchedule={(x) => setSchedFor(x)} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
