# WallSync 구조 문제점 및 추가·수정 기능 리스트업 (3차)

> 대상 브랜치: `claude/structure-issues-features-l8ifpd` (main `c81d970` 기준)
> 점검일: 2026-07-13
> 범위: 웹(React/TS) + 네이티브(Android/Java) + 빌드/의존성
> 이전 리스트업(A/B·A-/B-/C- 시리즈, `REMAINING_ISSUES.md`) 이후 코드 전체 재점검 결과.
> 이번 라운드는 **D 시리즈(구조·코드 문제점)** 와 **F 시리즈(추가·수정 기능)** 로 구분.

---

## 요약

| # | 심각도 | 항목 | 상태 |
|---|--------|------|------|
| D-1 | 🟠 Medium | 재부팅 시 경기 알람 전부 유실 — BOOT_COMPLETED 리시버 없음 (권한만 선언) | ✅ 1차 수정 (F-2) |
| D-2 | 🟠 Medium | `notifId` 해시가 JS 명세와 Java 구현에서 서로 다른 값 산출 (계약 깨짐) | ✅ 1차 수정 |
| D-3 | 🟠 Medium | "🔄 갱신" 전체 적용 시 실패한 소스에도 `lastApplied`·적용중 배지 갱신 | ✅ 1차 수정 |
| D-4 | 🟠 Medium | 미사용 `@capacitor/local-notifications`가 여전히 APK에 포함됨 | ✅ 1차 수정 |
| D-5 | 🟠 Medium | 백업 복원 검증 부족 — `target`/`auto`/`schedule` 미검증으로 이상 예약 가능 | ✅ 1차 수정 |
| D-6 | 🟡 Low | `loadSources` 스키마 검증 없음 — 손상 데이터가 그대로 상태에 유입 | ✅ 1차 수정 |
| D-7 | 🟡 Low | 경기 알림·실패 알림에 contentIntent 없음 — 탭해도 앱이 안 열림 | ✅ 1차 수정 (F-1) |
| D-8 | 🟡 Low | ScheduleModal 분 옵션 고정 — 목록 밖 분값이면 select가 빈 값 표시 | ✅ 1차 수정 |
| D-9 | 🟡 Low | 웹 미리보기에서 알림 `enabled=true`가 영구 저장됨 | ✅ 1차 수정 |
| D-10 | 🟡 Low | 경기 알림 워커 실패가 무통지·무기록 — 파이프라인 상태를 UI에서 알 수 없음 | ⏸ 보류 (F-8) |
| D-11 | 🟡 Low | `SimpleDateFormat` lenient 기본값 — JS 명세와 파싱 관대함 불일치 | ✅ 1차 수정 |
| D-12 | 🟡 Low | 핸들러의 네이티브 재예약 실패를 조용히 무시 (`handleTarget` 등) | ✅ 1차 수정 |
| D-13 | ⚪ 구조 | 홈/잠금 단일 `activeId` 모델 — 화면별 적용 상태 표현 불가 | ✅ 1차 수정 (F-5) |

기능(F 시리즈)은 [아래](#-f-시리즈--추가수정-기능) 참조. 우선 추천: **F-1(알림 탭→앱 열기), F-2(부팅 복구), F-4(Wi-Fi/충전 제약)**.

### ✅ 1차 수정 내역 (우선순위 1→4 순차 처리)
- **우선순위 1** — F-1(경기·실패 알림 contentIntent → 탭하면 앱 열림), F-2(BootReceiver 신설 + 설정 네이티브 저장 → 재부팅 직후 알람 즉시 복구), D-3(전체 갱신은 성공한 소스만 lastApplied·적용중 반영)
- **우선순위 2** — D-2(Java notifId를 `(h & 0xffffffffL) % 900000`으로 JS `>>>0` 명세와 정렬, 고정 벡터 교차 테스트를 JS/Java 양쪽에 추가·독립 JVM 실행으로 일치 확인), D-11(`setLenient(false)`)
- **우선순위 3** — D-4(LocalNotifications 의존성 제거 + cap sync 재생성 + README 현행화), D-5/D-6(`lib/sanitize.ts` 신설 — parseBackup·loadSources 공유 정규화, 손상 저장소 원문 보존)
- **우선순위 4** — F-4(Wi-Fi 전용·충전 중 실행 조건: Schedule 타입/모달 토글/네이티브 Constraints/daily 재예약 전파/카드 마커, D-8 분 옵션 보정 포함)
- **F-5/D-13** — 화면별 적용중(`ActiveMap`): 저장소 v2 키+자동 마이그레이션, 백업 v3(v1/v2 계속 수용), 히어로 화면별 행, 카드 배지 ✓홈/✓잠금/✓적용중, 대상 변경 시 미커버 화면 해제
- **잔여 Low** — D-9(웹에선 enabled 저장 안 함), D-12(대상 변경·편집·복원의 재예약 실패를 warn 토스트로 노출)
- **검증**: typecheck 클린 · vitest **57/57** · vite build 성공 · notifId Java 구현 독립 JVM 교차 실행 PASS. 네이티브 컴파일·실기기 동작(BootReceiver 발화, UNMETERED/충전 제약)은 CI·실기기에서 확인 필요.
- **보류(다음 후보)**: F-6 로테이션(대규모 — 별도 라운드 권장), F-7 백업 파일 가져오기, F-8 알림 파이프라인 상태 표시(D-10), F-9 응원팀 연동 제안, F-10 Play 배포 트랙

---

## D 시리즈 — 구조·코드 문제점

### D-1. 재부팅 시 경기 알람 전부 유실 🟠
- **위치**: `AndroidManifest.xml`(43행 `RECEIVE_BOOT_COMPLETED` 선언), 리시버 없음
- **현상**: AlarmManager 알람은 재부팅 시 시스템이 전부 삭제한다. `RECEIVE_BOOT_COMPLETED` 권한은 선언돼 있지만 **BOOT_COMPLETED를 받는 리시버가 없어** 재예약 트리거가 없다. WorkManager 주기 워커(`GameNotifyWorker`, 1일 주기)는 재부팅 후에도 살아 있으므로 최대 하루 안에 복구되지만, **그 사이에 시작하는 경기의 알림은 누락**된다. (예: 밤에 재부팅 → 다음 날 낮 경기 알림이 워커 실행 시점에 따라 빠질 수 있음)
- **권장**: `BootReceiver` 추가 → 부팅 시 경기 알림이 켜져 있으면(팀/lead를 SharedPreferences에 저장해두고) `UNIQUE_NOW` OneTimeWork를 즉시 enqueue. 알림 기능을 안 쓰면 no-op. 리시버를 추가하지 않을 거면 죽은 권한 선언은 제거.

### D-2. `notifId` 해시 — JS 명세와 Java 구현이 다른 값을 산출 🟠
- **위치**: `src/lib/schedule-plan.ts` `notifId()` ↔ `GameNotifyConst.java` `notifId()`
- **현상**: JS는 매 반복 `(h*31+c) >>> 0`(unsigned 32bit), Java는 signed int 오버플로 후 `Math.abs(h) % 900000`. 해시 누적값이 2³¹ 이상이 되는 입력(대략 절반)에서 **두 구현이 서로 다른 ID를 산출**한다. `schedule-plan.ts` 머리말에 "이 파일이 계약의 기준"이라고 명시했지만 계약이 이미 깨져 있음 — vitest가 검증하는 값과 실제 기기에서 쓰이는 값이 다르다. 또한 Java 쪽은 `Math.abs(Integer.MIN_VALUE)`가 음수라서 이론상 음수 ID 엣지도 있다.
- **영향**: 런타임은 Java만 쓰므로 당장 사용자 버그는 아니지만, "JS=테스트되는 명세, Java=미러" 구조의 신뢰가 무너진 상태. 향후 JS/Java 혼용(예: 알림 미리보기 UI) 시 실제 불일치로 이어짐.
- **권장**: Java를 `int h` 누적 후 `(int)((h & 0xffffffffL) % 900000)`으로 수정하면 JS `>>>0`과 정확히 일치(32bit mod 산술 동일). `ScheduleMathTest`에 JS 테스트와 동일 입력·기대값의 교차 검증 케이스 추가(A5 계약 테스트의 최소 형태).

### D-3. "🔄 갱신" 전체 적용 — 실패한 소스에도 성공 표시 🟠
- **위치**: `src/App.tsx` `handleApplyAll()` (259~267행)
- **현상**: 개별 `apply` 실패를 무시하고 진행하는 것까지는 의도인데, 성공 집계 후 `done = new Set(autos.map(...))`으로 **전체 auto 소스에 `lastApplied=now`를 기록**하고, `activeId`도 성공 여부와 무관하게 **마지막 auto 소스**로 설정한다. 일부 실패 시 실패한 카드가 "방금 전 적용"으로 표시되고, 실패한 소스가 "✓ 적용중" 배지를 받을 수 있다.
- **권장**: 성공한 id만 모아 `lastApplied` 갱신, `activeId`는 **마지막으로 성공한** 소스로 설정.

### D-4. 미사용 LocalNotifications 의존성이 APK에 포함 🟠
- **위치**: `package.json`(17행), `android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle`
- **현상**: 8차 수정(C-1)에서 JS 런타임은 LocalNotifications를 더 이상 쓰지 않지만, 의존성이 package.json에 남아 있어 `npx cap sync`가 gradle 포함을 계속 재생성 → **죽은 플러그인 코드가 APK에 계속 들어간다**(크기·노출면 증가, 플러그인 자체의 권한/리시버 포함).
- **권장**: `npm uninstall @capacitor/local-notifications` 후 `npx cap sync android`로 gradle 재생성 커밋. README의 "Capacitor LocalNotifications" 구조 설명도 현행화(네이티브 워커 방식으로).

### D-5. 백업 복원 검증 부족 — 이상 소스가 예약까지 이어짐 🟠
- **위치**: `src/lib/backup.ts` `parseBackup()`
- **현상**: `id`/`url`/`type`만 검사한다. `target`·`auto`·`schedule`·`name`이 없거나 엉뚱한 타입이어도 통과 →
  - `auto: true` + `schedule: { }`(kind 없음) 이면 `scheduleNative`가 `kind !== "interval"` 분기로 **daily로 취급**, `hour: undefined` → 네이티브 기본값 8:00으로 **조용히 잘못된 예약**이 걸린다.
  - `target` 누락 시 카드 TargetPicker 전부 미선택, 네이티브는 "both" 기본값 — 표시와 동작 불일치.
  - `name` 누락 시 카드 제목 빈 값.
- **권장**: parse 단계에서 필드 정규화(sanitize) — `target`은 3값 아니면 `"both"`, `schedule`은 형태 검증 실패 시 `null`+`auto:false`, `name` 기본값 부여, `lastApplied`/`addedAt` 숫자 아니면 초기화. 테스트 케이스 추가.

### D-6. `loadSources` 스키마 검증 없음 🟡
- **위치**: `src/storage.ts` `loadSources()`
- **현상**: JSON 파싱만 하고 항목 형태는 검증하지 않는다. localStorage가 손상되면 catch로 **전체 목록이 조용히 빈 배열**이 되거나(전량 손실), 파싱은 되지만 깨진 항목이 그대로 상태에 들어온다. D-5와 동일 계열.
- **권장**: D-5에서 만드는 정규화 로직을 `lib/`로 빼서 `parseBackup`과 `loadSources`가 공유(구조 일원화). 파싱 실패 시 raw 문자열을 `wallsync.sources.corrupt` 등으로 보존해 복구 여지 남기기.

### D-7. 알림 탭해도 앱이 안 열림 (contentIntent 없음) 🟡
- **위치**: `GameAlarmReceiver.java`(알림 빌더), `WallpaperWorker.java` `notifyFailure()`
- **현상**: 두 알림 모두 `setContentIntent` 미설정 — 경기 알림·갱신 실패 알림을 탭하면 아무 일도 일어나지 않는다. 특히 실패 알림은 "앱을 열어 원인 확인"이 자연스러운 다음 행동인데 진입로가 없다.
- **권장**: `MainActivity`를 여는 `PendingIntent.getActivity(...)`를 contentIntent로 부착 (F-1).

### D-8. ScheduleModal 분 옵션 밖 값이면 select 빈 표시 🟡
- **위치**: `src/components/ScheduleModal.tsx` (67행 `[0,10,15,20,30,45]`)
- **현상**: 백업 복원·과거 버전 데이터로 `minute`이 목록에 없는 값(예: 5)이면 select가 빈 값으로 렌더되고, 저장하면 사용자가 인지 못한 채 값이 바뀔 수 있다.
- **권장**: 현재 값이 목록에 없으면 옵션에 동적으로 추가하거나, 분 select를 0~55(5분 단위) 전체로 확장.

### D-9. 웹 미리보기에서 알림 `enabled=true` 영구 저장 🟡
- **위치**: `src/App.tsx` `saveNotif()` (124~127행)
- **현상**: 비네이티브에서 "동작 안 함" 경고를 띄우면서도 `persistNotif(next)`로 `enabled: true`를 저장한다. 표시(켜짐)와 실제(아무 것도 예약 안 됨)가 불일치 — M2에서 네이티브 쪽은 "예약 성공 시에만 저장"으로 고친 원칙과 어긋난다.
- **권장**: 웹에서는 `enabled`를 강제 false로 저장하거나 저장 자체를 스킵하고 안내만.

### D-10. 경기 알림 파이프라인 상태 무기록 🟡
- **위치**: `GameNotifyWorker.java` `doWork()` catch 분기
- **현상**: 일정 fetch가 5회 연속 실패하면 조용히 포기하고 다음 날 주기 실행을 기다린다. `SyncStatusStore` 같은 기록이 없어 **UI에서 "마지막 일정 동기화 시각·예약된 알림 개수"를 알 수 없다.** 비공식 API 의존(문서화된 리스크)인 만큼 API가 죽으면 사용자는 알림이 안 오는 이유를 알 길이 없다.
- **권장**: 워커가 성공/실패·예약 건수를 SharedPreferences에 기록하고 플러그인 조회 메서드 추가 → 알림 모달에 "마지막 동기화 N시간 전 · 예약 M건" 표시 (F-8).

### D-11. 네이티브 날짜 파싱이 JS 명세보다 관대함 🟡
- **위치**: `GameNotifyWorker.java` (70행 `SimpleDateFormat`)
- **현상**: `SimpleDateFormat`은 기본 lenient — `2026-13-45` 같은 비정상 날짜도 롤오버로 파싱된다. JS 명세(`schedule-plan.ts`)는 `Number.isFinite` 가드로 Invalid Date를 걸러내므로 **필터 계약 불일치의 또 다른 사례**(D-2와 같은 계열).
- **권장**: `fmt.setLenient(false)` 한 줄 추가.

### D-12. 네이티브 재예약 실패를 조용히 무시 🟡
- **위치**: `src/App.tsx` `handleTarget()`(159행), `handleEditorSubmit()`(172행), `handleImport()`(211~215행)
- **현상**: 대상 변경·URL 수정·복원 시 `scheduleNative` 실패를 `catch { /* ignore */ }`로 삼킨다. UI 표시는 바뀌었는데 백그라운드 작업은 이전 설정으로 남는 **표시≠실제** 불일치가 조용히 생길 수 있다. (예약 저장 `handleSchedSave`만 오류 토스트가 있음)
- **권장**: 최소한 warn 토스트로 노출 — "자동 갱신 재등록 실패, ⏰ 설정을 다시 저장해주세요".

### D-13. 홈/잠금 단일 `activeId` 모델 ⚪ (설계 과제)
- **위치**: `src/App.tsx` + `src/lib/active.ts`
- **현상**: 홈에 A, 잠금에 B를 적용하는 사용 방식이 가능함에도 "현재 적용 중"은 전역 1개만 추적한다. `resolveActive`가 최신 적용 1건만 고르므로 다른 화면의 적용 상태는 표시에서 사라진다.
- **권장**: `activeId`를 `{ home: id|null, lock: id|null }`로 확장하고 히어로 영역에 화면별 표시 (F-5). 저장 키 마이그레이션 필요(v1 → v2).

---

## F 시리즈 — 추가·수정 기능

### 수정 (기존 기능 보완)
- **F-1. 알림 탭 → 앱 열기** — D-7 해소. 경기·실패 알림에 contentIntent 부착. *(소규모, 우선 추천)*
- **F-2. 재부팅 직후 알림 복구** — D-1 해소. BootReceiver + 팀/lead 네이티브 저장. *(소규모, 우선 추천)*
- **F-3. 백업 복원 강건화** — D-5/D-6 해소. 정규화 공유 로직 + 테스트. *(소규모)*
- **F-8. 경기 알림 상태 표시** — D-10 해소. 알림 모달에 "마지막 동기화 · 예약 N건". *(중규모)*

### 추가 (신규 기능, 이전 라운드 보류분 포함)
- **F-4. Wi-Fi 전용 / 충전 중에만 갱신 옵션** *(이전 C-4/F5 보류분)* — `Constraints`에 `NetworkType.UNMETERED`·`setRequiresCharging` 반영. Schedule 타입·모달·플러그인 파라미터 확장. 데이터 요금 걱정 없는 안심 옵션. *(중규모)*
- **F-5. 홈/잠금 화면별 "적용중" 표시** — D-13 해소. per-target active 모델. *(중규모)*
- **F-6. 로테이션(여러 배경 순환)** *(이전 C-2/F3 보류분)* — 소스 그룹을 순서/랜덤으로 순환 적용하는 모드. 네이티브 워커가 다음 인덱스를 SharedPreferences로 관리. *(대규모)*
- **F-7. 백업 파일 가져오기** — 현재 붙여넣기만 지원. `<input type="file">` 기반 JSON 파일 선택 추가(WebView 동작 확인 필요, 실패 시 붙여넣기 폴백 유지). *(소규모)*
- **F-9. KBO 소스 팀 변경 시 응원팀 연동 제안** — 첫 저장 전 기본값 제안(B3)은 있으나, 이후 KBO 소스 팀을 바꿔도 알림 팀은 그대로. 팀 변경 시 "알림 응원팀도 바꿀까요?" 토스트 액션. *(소규모)*
- **F-10. Play 배포 준비 트랙** *(R3 연계)* — 배터리 직접 요청 제거 + `openBatterySettings` 안내 전환, cleartext를 network-security-config로 축소, targetSdk 최신화 점검. Play 배포 결정 시 일괄 진행. *(중규모, 배포 전제)*

### 우선순위 제안
1. **F-1 + F-2 + D-3** — 알림 신뢰성(탭 진입·재부팅 복구)과 갱신 표시 정확성. 작은 변경으로 체감 큰 것들.
2. **D-2 + D-11** — 명세↔네이티브 계약 복원(해시 정렬·lenient 차단) + 교차 테스트. 회귀 방지 기반.
3. **D-4 + F-3** — 죽은 의존성 제거, 백업/저장 강건화.
4. **F-4 → F-5 → F-6** — 기능 확장 단계(제약 옵션 → 화면별 상태 → 로테이션).
5. **F-10** — Play 배포 착수 시점에.

---

## 검증 메모
- 본 문서는 정적 점검 결과이며 코드 변경은 포함하지 않음.
- D-2 해시 불일치는 32bit 산술 규칙(JS `>>>0` vs Java signed `Math.abs`) 비교로 확인 — 누적 해시가 2³¹ 이상인 입력에서 상이한 ID 산출.
- D-4는 `capacitor.settings.gradle`/`capacitor.build.gradle`에 `capacitor-local-notifications` 포함이 남아 있음을 확인(런타임 import 없음).
