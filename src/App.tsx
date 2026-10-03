import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Wallpaper, WallpaperTarget, SyncResult } from "./wallpaper";
import { scheduleGameNotifications, cancelGameNotifications, hasNotifPermission, migrateLegacyNotifications } from "./notifications";
import { Source, Schedule, NotifSettings, BackupExtra, ToastMsg, ToastAction } from "./types";
import { C } from "./theme";
import { resolveActive } from "./lib/active";
import { uid } from "./lib/uid";
import * as store from "./storage";
import { Editor } from "./components/Editor";
import { ScheduleModal } from "./components/ScheduleModal";
import { NotifModal } from "./components/NotifModal";
import { BackupModal } from "./components/BackupModal";
import { SourceCard } from "./components/SourceCard";
import { Icon, Notice, iconBtn, outlineBtn, primaryBtn } from "./components/common";

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

  // 구버전이 예약한 로컬 알림 정리 (중복 알림 방지, 1회성)
  useEffect(() => { if (loaded) migrateLegacyNotifications(); }, [loaded]);

  // 앱을 열 때 알림이 켜져 있으면 다가오는 경기로 다시 예약
  useEffect(() => {
    if (!(loaded && native && notif.enabled)) return;
    (async () => {
      // 권한이 이미 거부됐다면 조용히 스킵 — 실행할 때마다 실패 토스트로 괴롭히지 않는다
      if (!(await hasNotifPermission())) return;
      try {
        await scheduleGameNotifications(notif.team, notif.lead);
        // 정시 알람 허용 안내는 알림 시트 안에 상시 표시하므로, 앱을 열 때마다 토스트로 띄우지 않는다
      } catch {
        toast("경기 알림을 다시 예약하지 못했어요. 알림 설정을 확인해 주세요", "warn");
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
        toast("정시 알림을 받으려면 ‘알람 및 리마인더’ 허용이 필요해요", "warn", {
          label: "설정 열기",
          fn: () => { Wallpaper.openExactAlarmSettings().catch(() => {}); },
        });
      }
    } catch { /* ignore */ }
  };

  const saveNotif = async (next: NotifSettings) => {
    if (!native) {
      persistNotif(next);
      toast("알림은 설치한 앱에서만 동작해요", "warn");
      return;
    }
    try {
      if (next.enabled) {
        // 예약이 실제로 성공했을 때만 '켜짐'으로 저장 (표시=실제 일치)
        await scheduleGameNotifications(next.team, next.lead);
        persistNotif(next);
        toast("경기 알림을 켰어요. 매일 자동으로 예약돼요");
        checkExactAlarm();
      } else {
        await cancelGameNotifications();
        persistNotif(next);
        toast("경기 알림을 껐어요", "warn");
      }
    } catch (e) { toast((e as Error).message || "알림을 예약하지 못했어요", "error"); }
  };

  const handleApply = async (s: Source) => {
    if (!native) { toast("실제 적용은 설치한 앱에서만 동작해요", "warn"); return; }
    try {
      await Wallpaper.apply({ url: s.url, target: s.target });
      setSources((p) => p.map((x) => (x.id === s.id ? { ...x, lastApplied: Date.now() } : x)));
      setActiveId(s.id);
      toast("배경화면을 적용했어요");
    } catch (e) { toast((e as Error).message || "적용하지 못했어요", "error"); }
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
      toast(`“${s.name}”을 수정했어요`);
    } else {
      setSources((p) => [s, ...p]);
      toast(`“${s.name}”을 추가했어요`);
    }
  };

  const handleSchedSave = async (id: string, auto: boolean, schedule: Schedule | null) => {
    const s = sources.find((x) => x.id === id);
    if (!s) return;
    setSources((p) => p.map((x) => (x.id === id ? { ...x, auto, schedule } : x)));
    if (!native) { toast("예약은 설치한 앱에서만 동작해요", "warn"); return; }
    try {
      if (auto && schedule) {
        // 같은 화면을 갱신하는 다른 자동 소스가 있으면 마지막 실행이 덮어씀 → 미리 경고
        const clash = sources.find((x) => x.id !== id && x.auto && targetsOverlap(x.target, s.target));
        if (clash) toast(`“${clash.name}”도 같은 화면을 자동 갱신 중이에요. 나중에 실행된 쪽이 덮어써요`, "warn");
        await scheduleNative(id, s.url, s.target, schedule);
        try { await Wallpaper.requestNotificationPermission(); } catch { /* ignore */ }
        toast("자동 갱신을 예약했어요");
      } else {
        await Wallpaper.cancel({ id });
        toast("자동 갱신을 껐어요", "warn");
      }
      refreshSync();
    } catch (e) { toast((e as Error).message || "예약하지 못했어요", "error"); }
  };

  const handleCopy = async (s: Source) => {
    try { await navigator.clipboard.writeText(s.url); toast("URL을 복사했어요"); }
    catch { toast("복사하지 못했어요. 길게 눌러 직접 복사해 주세요", "warn"); }
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
          toast("경기 알림을 다시 예약하지 못했어요. 알림 설정을 확인해 주세요", "warn"));
      }
    }
  };

  const handleDelete = (s: Source) => {
    const idx = sources.findIndex((x) => x.id === s.id);
    setSources((p) => p.filter((x) => x.id !== s.id));
    if (activeId === s.id) setActiveId(null);
    if (native) { Wallpaper.cancel({ id: s.id }).catch(() => {}); }
    toast(`“${s.name}”을 삭제했어요`, "warn", {
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
    if (!native) { toast("실제 적용은 설치한 앱에서만 동작해요", "warn"); return; }
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
    toast(ok === autos.length ? `${ok}개를 갱신했어요` : `${ok}/${autos.length}개를 갱신했어요 (일부 실패)`, ok === autos.length ? "success" : "warn");
  };

  const autoCount = sources.filter((s) => s.auto).length;
  const { src: activeSrc } = resolveActive(sources, activeId, syncStatus);

  // 알림 설정을 저장한 적 없으면 첫 KBO 소스의 팀을 기본 응원팀으로 제안
  const notifForModal = notifSaved
    ? notif
    : { ...notif, team: sources.find((s) => s.type === "kbo")?.kbo?.team ?? notif.team };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Noto Sans KR','Segoe UI',-apple-system,sans-serif" }}>
      <style>{`
        html,body{margin:0;background:${C.bg};color-scheme:dark}
        *{box-sizing:border-box} button,input,select,textarea{font-family:inherit}
        input::placeholder,textarea::placeholder{color:${C.muted}}
        :focus-visible{outline:3px solid #fff;outline-offset:2px}
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
        @keyframes toastIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sheetIn { from{transform:translateY(24px);opacity:0.6} to{transform:translateY(0);opacity:1} }
        @media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }
      `}</style>

      {/* 토스트: 화면 아래(추가 버튼 위)에 쌓아 제목·헤더를 가리지 않는다 */}
      <div role="status" aria-live="polite" style={{
        position: "fixed", left: 16, right: 16, bottom: "calc(92px + env(safe-area-inset-bottom))", zIndex: 999,
        display: "flex", flexDirection: "column", gap: 10, alignItems: "center", pointerEvents: "none",
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            pointerEvents: "auto", width: "100%", maxWidth: 440, boxSizing: "border-box", minHeight: 48,
            background: t.type === "error" ? C.toastError : t.type === "warn" ? C.warn : C.toastSuccess,
            color: t.type === "warn" ? C.onWarn : "#fff", borderRadius: 14, padding: t.action ? "4px 4px 4px 16px" : "12px 16px",
            fontSize: 14, fontWeight: 700, lineHeight: 1.4, boxShadow: "0 10px 28px rgba(0,0,0,0.5)", animation: "toastIn 0.25s ease",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <span>{t.msg}</span>
            {t.action && (
              <button type="button" onClick={() => { t.action!.fn(); setToasts((p) => p.filter((x) => x.id !== t.id)); }}
                style={{ height: 44, padding: "0 16px", border: "none", borderRadius: 10, background: "rgba(0,0,0,0.18)", color: "inherit", fontFamily: "inherit", fontSize: 14, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" }}>
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

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 0 120px" }}>
        {/* 헤더 */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 16px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: C.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="image" size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1.2 }}>WallSync</h1>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.3 }}>KBO·URL 배경화면 자동 갱신</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setShowNotif(true)} aria-label={`경기 알림 설정 (${notif.enabled ? "켜짐" : "꺼짐"})`} style={iconBtn(notif.enabled)}>
              <Icon name="bell" />
            </button>
            <button type="button" onClick={() => setShowBackup(true)} aria-label="백업 / 복원" style={iconBtn(false)}>
              <Icon name="download" />
            </button>
          </div>
        </header>

        {/* 상태 스트립 */}
        {!native && (
          <div style={{ margin: "8px 16px 0" }}>
            <Notice tone="warn" icon="info">미리보기(웹) 모드예요. 실제 배경화면 적용·자동 갱신은 Android 앱에서만 동작해요.</Notice>
          </div>
        )}

        {native && battOk === false && (
          <div style={{ margin: "8px 16px 0" }}>
            <Notice tone="warn" icon="alert">
              <div style={{ fontWeight: 700, marginBottom: 2 }}>배터리 최적화 해제가 필요해요</div>
              <div style={{ color: C.sub, marginBottom: 10 }}>켜져 있으면 백그라운드 자동 갱신이 끊길 수 있어요. 한 번만 해제하면 안정적으로 동작해요.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={async () => { try { await Wallpaper.requestIgnoreBatteryOptimizations(); } catch { /* */ } }}
                  style={{ ...primaryBtn(44), background: C.warn, color: C.onWarn }}>해제하기</button>
                <button type="button" onClick={async () => { try { await Wallpaper.openBatterySettings(); } catch { /* */ } }}
                  style={outlineBtn(C.sub, C.borderStrong)}>수동 설정</button>
              </div>
            </Notice>
          </div>
        )}

        {native && battOk !== false && autoCount > 0 && (
          <section aria-label="자동 갱신 상태" style={{ margin: "8px 16px 0", padding: "12px 12px 12px 14px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Icon name="checkCircle" size={22} style={{ color: C.teal, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>자동 갱신 {autoCount}개 동작 중</div>
                {battOk === true && <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.3 }}>배터리 최적화 해제됨</div>}
              </div>
            </div>
            <button type="button" onClick={handleApplyAll} disabled={applying} aria-label="자동 갱신 소스 지금 갱신" style={{ ...outlineBtn(C.text, C.borderStrong), opacity: applying ? 0.5 : 1, cursor: applying ? "default" : "pointer" }}>
              <Icon name="refresh" size={18} />{applying ? "갱신 중" : "지금 갱신"}
            </button>
          </section>
        )}

        {/* 목록 */}
        <main style={{ padding: 16 }}>
          {sources.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 16px", color: C.muted }}>
              <Icon name="image" size={44} stroke={1.4} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: C.sub }}>등록된 배경화면이 없어요</div>
              <div style={{ fontSize: 14, marginTop: 6, marginBottom: 20 }}>KBO 배경화면이나 이미지 URL을 추가해 보세요</div>
              <button type="button" onClick={() => setEditor({ editing: null })} style={{ ...primaryBtn(48), margin: "0 auto" }}>
                <Icon name="plus" size={20} stroke={2.2} />첫 배경화면 추가
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sources.map((s) => (
                <SourceCard key={s.id} src={s} sync={syncStatus[s.id]} active={s.id === activeSrc?.id}
                  onApply={handleApply} onTarget={handleTarget} onSchedule={(x) => setSchedFor(x)}
                  onEdit={(x) => setEditor({ editing: x })} onCopy={handleCopy} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* 추가 버튼 (엄지 닿는 곳) */}
      {sources.length > 0 && (
        <button type="button" onClick={() => setEditor({ editing: null })} style={{
          position: "fixed", right: 16, bottom: "calc(20px + env(safe-area-inset-bottom))", zIndex: 100, height: 56, padding: "0 22px 0 18px",
          border: "none", borderRadius: 28, background: C.accent, color: "#fff", fontFamily: "inherit", fontSize: 16, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer", boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
        }}>
          <Icon name="plus" size={22} stroke={2.2} />추가
        </button>
      )}
    </div>
  );
}
