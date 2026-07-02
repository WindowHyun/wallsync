# WallSync 점검 리포트 (수정 진행 + 재점검)

> 대상 브랜치: `claude/review-report-checklist-i2sus1`
> 최초 점검: 2026-06-24 · 수정/재점검: 2026-06-24
> 범위: 웹(React/TS) + 네이티브(Android/Java) + 빌드/CI 전체

---

## 처리 현황 요약

| # | 심각도 | 항목 | 상태 |
|---|--------|------|------|
| 1 | 🔴 High | 자동 갱신 후 target 변경이 백그라운드에 미반영 | ✅ 수정 |
| 2 | 🔴 High | "매일 HH:MM" 예약 시각 드리프트 | ✅ 수정 |
| 3 | 🔴 High | `http://` URL 네이티브 다운로드 실패 | ✅ 수정 |
| 4 | 🟠 Medium | 대용량 이미지 OOM 위험(다운샘플링 없음) | ✅ 수정 |
| 5 | 🟠 Medium | 배터리 최적화 권한 Play 정책 리스크 | ⏸ 보류(아래 설명) |
| 6 | 🟠 Medium | 미리보기/카드 dim 상태 잔존 | ✅ 수정 |
| 7 | 🟠 Medium | CI 타입체크 게이트 없음 | ✅ 수정 |
| 8 | 🟡 Low | 미사용 FileProvider | ⏸ 보류 |
| 9 | 🟡 Low | `allowBackup="true"` | ⏸ 보류 |
| 10 | 🟡 Low | work-runtime 버전 하드코딩 | ✅ 수정 |
| 11 | 🟡 Low | `uid()` 충돌 가능성 | ✅ 수정 |
| 12 | 🟡 Low | README 트리거 문구 불일치 | ✅ 수정 |
| 13 | 🟡 Low | `allowMixedContent` | ⏸ #3과 함께 정리 |

**검증**: `npm run typecheck` 통과, `npm run build` 성공. (네이티브 빌드는 GitHub Actions에서 검증)

---

## 수정 상세

### ✅ #1 자동 갱신 target 불일치
- **변경**: `src/App.tsx` — `handleTarget`를 async로 바꿔, 자동 갱신이 켜진 소스의 대상이 바뀌면 `scheduleNative()`로 백그라운드 작업을 새 대상으로 재등록.
- **효과**: 카드의 적용 대상 표시값과 실제 백그라운드 동작이 항상 일치.

### ✅ #2 매일 예약 시각 드리프트
- **변경**:
  - `src/wallpaper.ts` — `schedule`에 `mode("interval"|"daily")`, `dailyHour`, `dailyMinute` 추가.
  - `WallpaperPlugin.java` — daily는 `OneTimeWorkRequest`로 다음 정시에 예약, interval은 기존 `PeriodicWorkRequest` 유지.
  - `WallpaperWorker.java` — daily 실행 성공 시 `secondsUntilNextDaily()`로 **다음 날 같은 시각을 스스로 재예약**(self-rescheduling). `Calendar` 기반 정시 계산.
- **효과**: 매 실행이 항상 사용자가 지정한 HH:MM에 앵커링되어 누적 드리프트 제거. JS에서 시각을 계산해 넘기던 중복 로직(`dailyInitialDelay`)도 제거.

### ✅ #3 http URL 다운로드 실패
- **변경**: `AndroidManifest.xml` — `android:usesCleartextTraffic="true"` 추가(기존 `allowMixedContent: true` 의도와 일치).
- **효과**: 사용자가 입력한 `http://` 이미지 URL이 네이티브 다운로드에서도 정상 동작 → 미리보기-적용 불일치 해소.
- **트레이드오프**: 평문 트래픽 허용은 경미한 보안 약화. 임의 URL 적용이 핵심 기능이라 허용을 택함(향후 https 전용으로 강화 가능).

### ✅ #4 대용량 이미지 OOM 다운샘플링
- **변경**: `WallpaperHelper.java` — 본문을 `byte[]`로 받아 2-pass 디코드. `inJustDecodeBounds`로 원본 크기 측정 후 `WallpaperManager.getDesiredMinimumWidth/Height` 기준 `inSampleSize`(2의 거듭제곱) 적용.
- **효과**: QHD 등 큰 이미지/저사양 기기의 `OutOfMemoryError` 위험 완화.

### ✅ #6 미리보기/카드 dim 잔존
- **변경**: `src/App.tsx` — AddModal 미리보기와 SourceCard `img`에 `onLoad`로 opacity 복원.
- **효과**: 한번 로드 실패로 흐려진 뒤 정상 이미지로 바뀌면 다시 선명하게 표시.

### ✅ #7 CI 타입체크 게이트
- **변경**: `.github/workflows/build-apk.yml` — 빌드 전 `npm run typecheck` 단계 추가.

### ✅ #10 / #11 / #12 (Low)
- `variables.gradle` + `app/build.gradle` — `androidxWorkVersion`로 work-runtime 버전 변수화.
- `src/App.tsx` — `uid()`를 `crypto.randomUUID()` 우선(미지원 시 기존 방식 폴백)으로 충돌 위험 제거.
- `README.md` — 빌드 트리거(push/PR/수동) 및 typecheck 단계 반영.

---

## ⏸ 보류 항목 (의도적 미수정 / 제품 판단 필요)

### #5 `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` Play 정책
- 직접 요청 인텐트는 Play 심사 거절 위험이 있으나, **현재 배포 경로가 사이드로드(Debug APK)**이고 자동 갱신 안정성에 직접 기여하는 기능이라 유지.
- **Play Store 정식 배포 시점에** 직접 요청 제거 + `openBatterySettings()` 안내만 사용하도록 전환 권장. (코드상 폴백 경로는 이미 존재)

### #8 미사용 FileProvider / #9 `allowBackup` / #13 `allowMixedContent`
- 동작에는 영향이 없는 템플릿 잔재·정책 기본값. #3 해결로 `allowMixedContent`의 실질 부작용은 사라짐.
- 보안 강화를 원하면 별도 작업으로 FileProvider 제거, `allowBackup=false`, cleartext를 특정 도메인으로 제한하는 network-security-config 도입을 검토.

---

## 재점검에서 새로 확인한 사항 (회귀 없음)
- `handleTarget` async 전환이 `TargetPicker.onChange`(void) 시그니처와 충돌하지 않음 — 반환 Promise는 무시되며 정상.
- daily 워커가 적용 실패 시 `Result.retry()` 후 재예약하지 않아도, WorkManager 백오프로 같은 작업을 재시도하므로 체인이 끊기지 않음(성공 시에만 다음 날 예약).
- `crypto.randomUUID()`로 길어진 ID가 WorkManager 고유 작업명(`wallsync_<id>`)에 그대로 사용 가능.
- `npm run typecheck` / `npm run build` 모두 통과.
