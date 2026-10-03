import { useEffect, useId, useRef, useState } from "react";
import { C } from "../theme";
import { WallpaperTarget } from "../wallpaper";

// ─── 아이콘 (이모지 대신 선 아이콘) ─────────────────────────────────────────────────
const ICONS = {
  image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M4 18l5-5 4 4 3-3 4 4" /></>,
  imageOff: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M4 18l5-5 4 4 3-3 4 4" /><path d="M3 3l18 18" /></>,
  bell: <><path d="M6 17v-6a6 6 0 1 1 12 0v6l1.5 2h-15z" /><path d="M10 21h4" /></>,
  download: <><path d="M12 4v11" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.5-5.8" /><path d="M20 4v5h-5" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16v.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></>,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  bolt: <path d="M13 3L5 13h6l-1 8 8-10h-6z" />,
  edit: <path d="M4 20l4-1 11-11-3-3L5 16z" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></>,
} as const;
export type IconName = keyof typeof ICONS | "more";

export function Icon({ name, size = 20, stroke = 1.8, style }: { name: IconName; size?: number; stroke?: number; style?: React.CSSProperties }) {
  if (name === "more") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={style}>
        <circle cx="5.5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="18.5" cy="12" r="1.8" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      {ICONS[name]}
    </svg>
  );
}

// ─── 버튼 스타일 (터치 영역 44px 이상) ──────────────────────────────────────────────
const btnBase: React.CSSProperties = {
  fontFamily: "inherit", fontWeight: 700, cursor: "pointer", display: "inline-flex",
  alignItems: "center", justifyContent: "center", gap: 6, padding: "0 16px", whiteSpace: "nowrap",
};
export const primaryBtn = (height = 52): React.CSSProperties => ({
  ...btnBase, height, border: "none", borderRadius: height >= 52 ? 14 : 12, background: C.accent, color: "#fff", fontSize: height >= 52 ? 16 : 14,
});
export const outlineBtn = (color: string = C.accentText, line: string = C.accentLine, height = 44): React.CSSProperties => ({
  ...btnBase, height, border: `1.5px solid ${line}`, borderRadius: 12, background: "transparent", color, fontSize: 14,
});
export const iconBtn = (active = false): React.CSSProperties => ({
  ...btnBase, width: 44, height: 44, padding: 0, flexShrink: 0, borderRadius: 12,
  border: `1.5px solid ${active ? C.teal : C.borderStrong}`,
  background: active ? C.tealSoft : "transparent", color: active ? C.teal : C.sub,
});

// ─── 폼 요소 ────────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: C.sub, marginBottom: 6 };

/** 입력 요소와 연결되는 <label>. htmlFor 가 없으면(그룹 라벨) id 를 가진 div 로 그린다. */
export function Lbl({ children, htmlFor, id, optional }: { children: React.ReactNode; htmlFor?: string; id?: string; optional?: boolean }) {
  const body = <>{children}{optional && <span style={{ fontWeight: 400, color: C.muted }}> (선택)</span>}</>;
  return htmlFor
    ? <label htmlFor={htmlFor} style={labelStyle}>{body}</label>
    : <div id={id} style={labelStyle}>{body}</div>;
}

export const fieldStyle: React.CSSProperties = {
  width: "100%", height: 48, boxSizing: "border-box", borderRadius: 12, border: `1.5px solid ${C.borderStrong}`,
  background: C.bg, color: C.text, fontFamily: "inherit", fontSize: 15, padding: "0 14px",
};

export function Select({ label, value, onChange, options, flex }: {
  label: string; value: string; onChange: (v: string) => void; options: string[][]; flex?: number;
}) {
  const id = useId();
  return (
    <div style={{ flex: flex ?? 1, minWidth: 0 }}>
      <Lbl htmlFor={id}>{label}</Lbl>
      <div style={{ position: "relative" }}>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
          style={{ ...fieldStyle, appearance: "none", WebkitAppearance: "none", padding: "0 36px 0 14px" }}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <Icon name="chevronDown" size={20} stroke={2} style={{ position: "absolute", right: 12, top: 14, color: C.sub, pointerEvents: "none" }} />
      </div>
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, optional, type = "text", error }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; optional?: boolean; type?: string; error?: string | null;
}) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div>
      <Lbl htmlFor={id} optional={optional}>{label}</Lbl>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined}
        style={{ ...fieldStyle, ...(error ? { border: `2px solid ${C.error}`, height: 52 } : {}) }} />
      {error && (
        <div id={errId} role="alert" style={{ display: "flex", gap: 8, marginTop: 8, color: C.error, fontSize: 13, lineHeight: 1.5, fontWeight: 500 }}>
          <Icon name="alert" size={16} stroke={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// 3분할 선택 (홈 / 잠금 / 둘 다) — 눌림 상태는 aria-pressed
export function Segmented<T extends string>({ options, value, onChange, label, labelledBy, height = 44 }: {
  options: [T, string][]; value: T; onChange: (v: T) => void; label?: string; labelledBy?: string; height?: number;
}) {
  return (
    <div role="group" aria-label={label} aria-labelledby={labelledBy}
      style={{ display: "flex", padding: 3, gap: 3, borderRadius: 12, background: C.surface, height, boxSizing: "border-box" }}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <button key={v} type="button" aria-pressed={on} onClick={() => onChange(v)} style={{
            flex: 1, border: "none", borderRadius: 9, padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13,
            background: on ? C.segmentOn : "transparent", color: on ? "#fff" : C.sub, fontWeight: on ? 700 : 500,
          }}>{l}</button>
        );
      })}
    </div>
  );
}

// 탭 (추가 방식 / 갱신 방식)
export function Tabs<T extends string>({ options, value, onChange, label }: {
  options: [T, string][]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="tablist" aria-label={label} style={{ display: "flex", gap: 4, padding: 4, height: 52, boxSizing: "border-box", borderRadius: 14, background: C.bg }}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <button key={v} type="button" role="tab" aria-selected={on} onClick={() => onChange(v)} style={{
            flex: 1, borderRadius: 11, padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 15,
            border: `1.5px solid ${on ? C.borderStrong : "transparent"}`,
            background: on ? C.card : "transparent", color: on ? "#fff" : C.sub, fontWeight: on ? 700 : 500,
          }}>{l}</button>
        );
      })}
    </div>
  );
}

// 숫자 선택 칩 (알림 시점, 갱신 주기)
export function ChipGroup<T extends string | number>({ options, value, onChange, labelledBy, columns = 4 }: {
  options: [T, string][]; value: T; onChange: (v: T) => void; labelledBy: string; columns?: number;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8 }}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <button key={String(v)} type="button" aria-pressed={on} onClick={() => onChange(v)} style={{
            height: 44, borderRadius: 12, padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14,
            border: `1.5px solid ${on ? C.accentLine : C.borderStrong}`,
            background: on ? C.accentSoft : "transparent", color: on ? "#fff" : C.sub, fontWeight: on ? 700 : 500,
          }}>{l}</button>
        );
      })}
    </div>
  );
}

export function SwitchRow({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 16px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
      <div id={id}>
        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.4 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.4 }}>{desc}</div>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} onClick={() => onChange(!checked)} style={{
        position: "relative", flexShrink: 0, width: 56, height: 32, borderRadius: 16, padding: 0, cursor: "pointer",
        border: checked ? "none" : `1.5px solid ${C.muted}`, background: checked ? C.accent : "transparent",
      }}>
        <span style={{
          position: "absolute", top: checked ? 4 : 3.5, left: checked ? 28 : 4, width: checked ? 24 : 21, height: checked ? 24 : 21,
          borderRadius: "50%", background: checked ? "#fff" : C.sub, transition: "left 0.15s",
        }} />
      </button>
    </div>
  );
}

/** 안내 줄 (info / success / warn) */
export function Notice({ tone, icon, children, action }: {
  tone: "success" | "warn"; icon: IconName; children: React.ReactNode; action?: React.ReactNode;
}) {
  const t = tone === "success"
    ? { bg: C.tealWash, line: C.tealLine, fg: C.teal }
    : { bg: C.warnWash, line: C.warnLine, fg: C.warn };
  return (
    <div style={{ display: "flex", alignItems: action ? "center" : "flex-start", gap: 10, padding: action ? "8px 8px 8px 14px" : "12px 14px", borderRadius: 14, background: t.bg, border: `1px solid ${t.line}` }}>
      <Icon name={icon} size={18} stroke={2} style={{ flexShrink: 0, color: t.fg, marginTop: action ? 0 : 1 }} />
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: C.text }}>{children}</div>
      {action}
    </div>
  );
}

// ─── 이미지 썸네일 (불러오는 중 / 실패 상태 표시) ──────────────────────────────────────
export type ImgStatus = "loading" | "ok" | "error";

export function Thumb({ src, width, height, alt, onStatus, radius = 12 }: {
  src: string; width: number | string; height: number | string; alt: string; onStatus?: (s: ImgStatus) => void; radius?: number;
}) {
  const [status, setStatus] = useState<ImgStatus>("loading");
  const ref = useRef<HTMLImageElement>(null);
  const cb = useRef(onStatus);
  cb.current = onStatus;
  const set = (s: ImgStatus) => { setStatus(s); cb.current?.(s); };

  // src 가 바뀌면 다시 로딩. 이미 캐시로 로드가 끝난 이미지는 onLoad 가 오지 않을 수 있어 직접 확인한다.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete) set(img.naturalWidth > 0 ? "ok" : "error");
    else set("loading");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div style={{
      position: "relative", flexShrink: 0, width, height, borderRadius: radius, overflow: "hidden", boxSizing: "border-box",
      background: C.bg, border: status === "error" ? `1.5px dashed ${C.borderStrong}` : `1px solid ${C.border}`,
    }}>
      <img ref={ref} key={src} src={src} alt={status === "ok" ? alt : ""}
        onLoad={() => set("ok")} onError={() => set("error")}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: status === "ok" ? 1 : 0 }} />
      {status !== "ok" && (
        <div role={status === "error" ? "img" : undefined} aria-label={status === "error" ? `${alt} — 미리보기 없음` : undefined}
          style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: C.muted, background: C.surface }}>
          <Icon name={status === "error" ? "imageOff" : "image"} size={26} stroke={1.6} />
          <span style={{ fontSize: 12, lineHeight: 1.3, textAlign: "center" }}>
            {status === "error" ? <>미리보기<br />없음</> : "불러오는 중"}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── 하단 시트 (모달) ───────────────────────────────────────────────────────────────
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * 접근 가능한 모달: role=dialog · Esc 로 닫기 · 포커스 이동/복귀 · Tab 순환.
 * onClose 는 ref 로 들고 있어, 부모가 다시 렌더돼도 포커스를 빼앗지 않는다.
 */
export function Sheet({ title, subtitle, onClose, children, maxWidth = 460 }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; maxWidth?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      const cur = document.activeElement;
      if (e.shiftKey && (cur === first || cur === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, []);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 200,
      display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center",
    }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} style={{
        width: "100%", maxWidth, maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box", outline: "none",
        background: C.surface, borderTop: `1px solid ${C.border}`, borderRadius: "28px 28px 0 0",
        padding: "12px 16px calc(24px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 16,
        animation: "sheetIn 0.22s ease",
      }}>
        <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 2, background: C.borderStrong, alignSelf: "center", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: -4 }}>
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h2>
            {subtitle && <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" style={{
            width: 44, height: 44, border: "none", background: "transparent", color: C.sub, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 0, marginRight: -8, flexShrink: 0,
          }}><Icon name="x" size={22} stroke={2} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// 홈/잠금/둘 다
export const TARGET_OPTIONS: [WallpaperTarget, string][] = [["home", "홈"], ["lock", "잠금"], ["both", "둘 다"]];
export function TargetPicker({ value, onChange, labelledBy, height }: { value: WallpaperTarget; onChange: (t: WallpaperTarget) => void; labelledBy?: string; height?: number }) {
  return <Segmented options={TARGET_OPTIONS} value={value} onChange={onChange} label={labelledBy ? undefined : "적용 대상"} labelledBy={labelledBy} height={height} />;
}
