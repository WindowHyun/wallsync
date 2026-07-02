import { C } from "../theme";
import { WallpaperTarget } from "../wallpaper";

export function Lbl({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, color: C.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>{children}</label>;
}

export function TargetPicker({ value, onChange }: { value: WallpaperTarget; onChange: (t: WallpaperTarget) => void }) {
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

export const ghostMini: React.CSSProperties = {
  flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${C.border}`,
  background: "transparent", color: C.sub, fontSize: 11, fontWeight: 600, cursor: "pointer",
};
