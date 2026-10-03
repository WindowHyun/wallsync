import { useEffect, useId, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { NotifSettings } from "../types";
import { Wallpaper } from "../wallpaper";
import { C } from "../theme";
import { TEAMS } from "../lib/kbo";
import { leadLabel } from "../lib/format";
import { ChipGroup, Lbl, Notice, Select, Sheet, SwitchRow, outlineBtn, primaryBtn } from "./common";

const LEADS = [30, 60, 120, 180];

// ─── 경기 알림 시트 ────────────────────────────────────────────────────────────────
export function NotifModal({ settings, onSave, onClose }: { settings: NotifSettings; onSave: (s: NotifSettings) => void; onClose: () => void }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [team, setTeam] = useState(settings.team);
  const [lead, setLead] = useState(settings.lead);
  const leadId = useId();

  // Android 12+ 에서 정시 알람이 막혀 있으면 알림이 늦게 온다 → 토스트 대신 시트 안에 상시 안내
  const [exactBlocked, setExactBlocked] = useState(false);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    Wallpaper.canScheduleExactAlarms().then((r) => setExactBlocked(!r.allowed)).catch(() => {});
  }, []);

  return (
    <Sheet title="경기 알림" onClose={onClose}>
      <SwitchRow title="경기 시작 전 알림" desc="응원팀 경기 전에 알려드려요" checked={enabled} onChange={setEnabled} />

      <fieldset disabled={!enabled} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 18, opacity: enabled ? 1 : 0.55 }}>
        <div style={{ display: "flex" }}>
          <Select label="응원팀" value={team} onChange={setTeam} options={TEAMS} />
        </div>
        <div>
          <Lbl id={leadId}>알림 시점 (경기 시작 전)</Lbl>
          <ChipGroup labelledBy={leadId} value={lead} onChange={setLead} options={LEADS.map((m): [number, string] => [m, leadLabel(m)])} />
        </div>
      </fieldset>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Notice tone="success" icon="checkCircle">매일 백그라운드에서 다가오는 경기를 자동 예약해요. 앱을 열지 않아도 유지돼요.</Notice>
        {exactBlocked && enabled && (
          <Notice tone="warn" icon="alert" action={
            <button type="button" onClick={() => { Wallpaper.openExactAlarmSettings().catch(() => {}); }}
              style={{ ...outlineBtn(C.warn, C.warn), flexShrink: 0, padding: "0 14px" }}>설정 열기</button>
          }>
            정시에 받으려면 ‘알람 및 리마인더’ 허용이 필요해요.
          </Notice>
        )}
      </div>

      <button type="button" onClick={() => { onSave({ enabled, team, lead }); onClose(); }} style={primaryBtn(52)}>저장</button>
    </Sheet>
  );
}
