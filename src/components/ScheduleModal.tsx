import { useId, useState } from "react";
import { Source, Schedule } from "../types";
import { C } from "../theme";
import { ChipGroup, Icon, Lbl, Select, Sheet, SwitchRow, Tabs, outlineBtn, primaryBtn } from "./common";

const HOURS = [1, 2, 3, 4, 6, 8, 12, 24];
const MINUTES = [0, 10, 15, 20, 30, 45];

// ─── 자동 갱신 시트 ────────────────────────────────────────────────────────────────
export function ScheduleModal({ src, onSave, onTest, onClose }: { src: Source; onSave: (auto: boolean, s: Schedule | null) => void; onTest: () => void; onClose: () => void }) {
  const [enabled, setEnabled] = useState(src.auto);
  const [kind, setKind] = useState<"interval" | "daily">(src.schedule?.kind ?? "interval");
  const [hours, setHours] = useState(src.schedule?.kind === "interval" ? src.schedule.hours : 6);
  const [hour, setHour] = useState(src.schedule?.kind === "daily" ? src.schedule.hour : 8);
  const [minute, setMinute] = useState(src.schedule?.kind === "daily" ? src.schedule.minute : 0);
  const everyId = useId();

  // 백업 복원 등으로 목록에 없는 분(예: 5분)이 들어와도 선택값이 틀어지지 않게 포함한다
  const minuteOpts = (MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b))
    .map((m): [string, string] => [String(m), `${String(m).padStart(2, "0")}분`]);

  const save = () => {
    if (!enabled) { onSave(false, null); onClose(); return; }
    const s: Schedule = kind === "interval" ? { kind, hours } : { kind: "daily", hour, minute };
    onSave(true, s);
    onClose();
  };

  return (
    <Sheet title="자동 갱신" subtitle={src.name} onClose={onClose}>
      <SwitchRow title="자동 갱신" desc="백그라운드에서 이미지를 다시 받아요" checked={enabled} onChange={setEnabled} />

      <fieldset disabled={!enabled} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 16, opacity: enabled ? 1 : 0.55 }}>
        <Tabs label="갱신 방식" value={kind} onChange={setKind} options={[["interval", "반복 주기"], ["daily", "매일 특정 시간"]]} />

        {kind === "interval" ? (
          <div>
            <Lbl id={everyId}>몇 시간마다</Lbl>
            <ChipGroup labelledBy={everyId} value={hours} onChange={setHours} options={HOURS.map((h): [number, string] => [h, `${h}시간`])} />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12 }}>
            <Select label="시" value={String(hour)} onChange={(v) => setHour(+v)}
              options={Array.from({ length: 24 }, (_, i): [string, string] => [String(i), `${String(i).padStart(2, "0")}시`])} />
            <Select label="분" value={String(minute)} onChange={(v) => setMinute(+v)} options={minuteOpts} />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.5, color: C.sub }}>
          <Icon name="info" size={16} stroke={2} style={{ flexShrink: 0, marginTop: 2, color: C.muted }} />
          <span>Android 정책상 최소 간격은 15분이고, 배터리 절약 상태에 따라 실제 실행이 늦어질 수 있어요.</span>
        </div>
      </fieldset>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onTest} style={{ ...outlineBtn(C.teal, C.teal, 48), borderRadius: 14, fontSize: 15 }}>
          <Icon name="bolt" size={18} stroke={2} />지금 한 번 적용해 보기
        </button>
        <button type="button" onClick={save} style={primaryBtn(52)}>저장</button>
      </div>
    </Sheet>
  );
}
