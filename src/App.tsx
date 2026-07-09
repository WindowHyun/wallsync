import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Wallpaper, WallpaperTarget, SyncResult } from "./wallpaper";
import { scheduleGameNotifications, cancelGameNotifications, hasNotifPermission } from "./notifications";
import { Source, Schedule, NotifSettings, BackupExtra, ToastMsg, ToastAction } from "./types";
import { C, teamColor } from "./theme";
import { rel, targetLabel } from "./lib/format";
import { resolveActive } from "./lib/active";
import { uid } from "./lib/uid";
import * as store from "./storage";
import { Editor } from "./components/Editor";
import { ScheduleModal } from "./components/ScheduleModal";
import { NotifModal } from "./components/NotifModal";
import { BackupModal } from "./components/BackupModal";
import { SourceCard } from "./components/SourceCard";

const native = Capacitor.isNativePlatform();

// 네이티브 예약 등록 (interval/daily). daily는 네이티브가 매 실행마다 다음 정시를
// 스스로 재예약하므로 시각이 드리프트되지 않는다.
function scheduleNative(id: string, url: string, target: WallpaperTarget, s: Schedule) {
  if (s.kind === "interval") {
    return Wallpaper.schedule({ id, url, target, mode: "interval", intervalMinutes: s.hours * 60 });
  }
  return Wallpaper.schedule({ id, url, target, mode: "daily", dailyHour: s.hour, dailyMinute: s.minute });
}

// 두 소스의 적용 대상이 같은 화면을 덮는지 (both는 모든 대상과 겹침)
const targetsOverlap = (a: WallpaperTarget, b: WallpaperTarget) =>
  a === b || a === "both" || b === "both";

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
  const [notifSaved, setNotifSaved] = useState(false); // 사용자가 알림 설정을 저장한 적 있는지

  useEffect(() => {
    setSources(store.loadSources());
    setActiveId(store.loadActiveId());
    const n = store.loadNotif();
    if (n) { setNotif(n); setNotifSaved(true); }
    setLoaded(true);
  }, []);

  // 앱을 열 때 알림이 켜져 있으면 다가오는 경기로 다시 예약
  useEffect(() => {
    if (!(loaded && native && notif.enabled)) return;
    (async () => {
      // 권한이 이미 거부됐다면 조용히 스킵 — 실행할 때마다 실패 토스트로 괴롭히지 않는다
      if (!(await hasNotifPermission())) return;
      try {
        await scheduleGameNotifications(notif.team, notif.lead);
        checkExactAlarm();
      } catch {
        toast("경기 알림 재예약 실패 — 🔔 설정을 다시 확인해주세요", "warn");
      }
    })();
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

  useEffect(() => { if (loaded) store.saveSources(sources); }, [sources, loaded]);
  useEffect(() => { if (loaded) store.saveActiveId(activeId); }, [activeId, loaded]);

  const toast = useCallback((msg: string, type: ToastMsg["type"] = "success", action?: ToastAction) => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, type, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 5000 : 3200);
  }, []);

  const persistNotif = (next: NotifSettings) => {
    setNotif(next);
    setNotifSaved(true);
    store.saveNotifSettings(next);
  };

  // Android 12+에서 정시 알람이 막혀 있으면 알림이 늦게 온다 → 설정 유도
  const checkExactAlarm = async () => {
    try {
      const r = await Wallpaper.canScheduleExactAlarms();
      if (!r.allowed) {
        toast("정시 알림을 받으려면 '알람 및 리마인더' 허용이 필요합니다", "warn", {
          label: "설정 열기",
          fn: () => { Wallpaper.openExactAlarmSettings().catch(() => {}); },
        });
      }
    } catch { /* ignore */ }
  };

  const saveNotif = async (next: NotifSettings) => {
    if (!native) {
      persistNotif(next);
      toast("알림은 설치된 앱에서만 동작합니다", "warn");
      return;
    }
    try {
      if (next.enabled) {
        // 예약이 실제로 성공했을 때만 '켜짐'으로 저장 (표시=실제 일치)
        await scheduleGameNotifications(next.team, next.lead);
        persistNotif(next);
        toast("🔔 경기 알림 켜짐 — 매일 자동 예약됩니다");
        checkExactAlarm();
      } else {
        await cancelGameNotifications();
        persistNotif(next);
        toast("경기 알림 해제됨", "warn");
      }
    } catch (e) { toast((e as Error).message || "알림 예약 실패", "error"); }
  };

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
    const prev = sources.find((x) => x.id === s.id);
    if (prev) {
      // URL이 바뀌면 이전 적용 이력은 다른 이미지의 것 → 리셋해 표시 정합 유지
      const urlChanged = prev.url !== s.url;
      const next = urlChanged ? { ...s, lastApplied: null } : s;
      setSources((p) => p.map((x) => (x.id === s.id ? next : x)));
      if (urlChanged && activeId === s.id) setActiveId(null);
      if (native && next.auto && next.schedule) {
        try { await scheduleNative(next.id, next.url, next.target, next.schedule); } catch { /* ignore */ }
      }
      toast(`✓ "${s.name}" 수정됨`);
    } else {
      setSources((p) => [s, ...p]);
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
        // 같은 화면을 갱신하는 다른 자동 소스가 있으면 마지막 실행이 덮어씀 → 미리 경고
        const clash = sources.find((x) => x.id !== id && x.auto && targetsOverlap(x.target, s.target));
        if (clash) toast(`⚠ "${clash.name}"도 같은 화면을 자동 갱신 중 — 나중에 실행된 쪽이 덮어씁니다`, "warn");
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
  const handleImport = async (imported: Source[], extra: BackupExtra) => {
    if (native) {
      try {
        for (const old of sources) { try { await Wallpaper.cancel({ id: old.id }); } catch { /* ignore */ } }
        for (const s of imported) {
          if (s.auto && s.schedule) { try { await scheduleNative(s.id, s.url, s.target, s.schedule); } catch { /* ignore */ } }
        }
      } catch { /* ignore */ }
    }
    setSources(imported);
    // v2 백업이면 적용중·경기알림 설정도 복원
    if (extra.activeId !== undefined) {
      setActiveId(extra.activeId && imported.some((s) => s.id === extra.activeId) ? extra.activeId : null);
    }
    if (extra.notif) {
      persistNotif(extra.notif);
      if (native && extra.notif.enabled) {
        scheduleGameNotifications(extra.notif.team, extra.notif.lead).catch(() =>
          toast("경기 알림 재예약 실패 — 🔔 설정을 다시 확인해주세요", "warn"));
      }
    }
  };

  const handleDelete = (s: Source) => {
    const idx = sources.findIndex((x) => x.id === s.id);
    setSources((p) => p.filter((x) => x.id !== s.id));
    if (activeId === s.id) setActiveId(null);
    if (native) { Wallpaper.cancel({ id: s.id }).catch(() => {}); }
    toast(`"${s.name}" 삭제됨`, "warn", {
      label: "실행취소",
      fn: () => {
        setSources((p) => {
          if (p.find((x) => x.id === s.id)) return p;
          const at = Math.min(Math.max(idx, 0), p.length); // 원래 위치로 복원
          return [...p.slice(0, at), s, ...p.slice(at)];
        });
        if (native && s.auto && s.schedule) { scheduleNative(s.id, s.url, s.target, s.schedule).catch(() => {}); }
      },
    });
  };

  const [applying, setApplying] = useState(false);

  // 자동 갱신 소스들을 지금 즉시 다시 내려받아 적용 (KBO는 매일 이미지가 바뀌므로 강제 최신화)
  const handleApplyAll = async () => {
    if (!native) { toast("실제 적용은 설치된 앱에서만 동작합니다", "warn"); return; }
    const autos = sources.filter((s) => s.auto);
    if (autos.length === 0) return;
    setApplying(true);
    let ok = 0;
    const now = Date.now();
    for (const s of autos) {
      try { await Wallpaper.apply({ url: s.url, target: s.target }); ok++; }
      catch { /* 개별 실패는 넘어가고 계속 */ }
    }
    if (ok > 0) {
      const done = new Set(autos.map((s) => s.id));
      setSources((p) => p.map((x) => (done.has(x.id) ? { ...x, lastApplied: now } : x)));
      setActiveId(autos[autos.length - 1].id);
    }
    setApplying(false);
    toast(ok === autos.length ? `✓ ${ok}개 갱신 완료` : `${ok}/${autos.length}개 갱신 (일부 실패)`, ok === autos.length ? "success" : "warn");
  };

  const autoCount = sources.filter((s) => s.auto).length;
  const { src: activeSrc, time: activeTime } = resolveActive(sources, activeId, syncStatus);

  // 알림 설정을 저장한 적 없으면 첫 KBO 소스의 팀을 기본 응원팀으로 제안
  const notifForModal = notifSaved
    ? notif
    : { ...notif, team: sources.find((s) => s.type === "kbo")?.kbo?.team ?? notif.team };

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
      {showNotif && <NotifModal settings={notifForModal} onSave={saveNotif} onClose={() => setShowNotif(false)} />}
      {showBackup && <BackupModal sources={sources} notif={notif} activeId={activeId} onImport={handleImport} onClose={() => setShowBackup(false)} toast={toast} />}
      {schedFor && <ScheduleModal src={schedFor} onSave={(auto, s) => handleSchedSave(schedFor.id, auto, s)} onTest={() => handleApply(schedFor)} onClose={() => setSchedFor(null)} />}

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 18px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "-0.5px", background: `linear-gradient(90deg,${C.accent},#A78BFA)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🖼️ WallSync</h1>
            <p style={{ margin: "3px 0 0", color: C.sub, fontSize: 12 }}>URL·KBO 배경화면 자동 갱신</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {autoCount > 0 && <div style={{ padding: "6px 12px", borderRadius: 10, background: C.tealSoft, border: `1px solid ${C.teal}`, color: C.teal, fontSize: 12, fontWeight: 700 }}>⚡ {autoCount}개 자동</div>}
            {autoCount > 0 && <button onClick={handleApplyAll} disabled={applying} title="자동 소스 지금 갱신" aria-label="자동 소스 지금 갱신" style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 11, padding: "9px 12px", color: C.sub, fontSize: 13, fontWeight: 700, cursor: applying ? "default" : "pointer", opacity: applying ? 0.5 : 1 }}>{applying ? "…" : "🔄 갱신"}</button>}
            <button onClick={() => setShowNotif(true)} title="경기 알림" aria-label="경기 알림 설정" style={{ background: notif.enabled ? C.tealSoft : "transparent", border: `1px solid ${notif.enabled ? C.teal : C.border}`, borderRadius: 11, padding: "9px 12px", color: notif.enabled ? C.teal : C.sub, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🔔</button>
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
              <div style={{ fontSize: 11, color: C.sub }}>{activeTime ? `${rel(activeTime)} 적용` : "미적용"} · {targetLabel(activeSrc.target)}</div>
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
                <SourceCard key={s.id} src={s} sync={syncStatus[s.id]} active={s.id === activeSrc?.id}
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
