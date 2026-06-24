# WallSync 남은 문제점 점검 리포트

> 대상 브랜치: `claude/review-report-checklist-i2sus1`
> 점검일: 2026-06-24 (1차 수정 `d56ecce` → 2차 수정 반영 후 재점검)
> 범위: 웹(React/TS) + 네이티브(Android/Java) + 빌드/CI
> **본 문서는 잔여 이슈와 처리 현황을 정리합니다.**

---

## 요약

1차 수정으로 High 3·Medium 3·Low 3건 해소. **2차 수정에서 R1·R2 추가 해소.** 나머지는 보류/저우선.

| # | 심각도 | 항목 | 상태 |
|---|--------|------|------|
| R1 | 🟠 Medium | daily↔interval 모드 전환 시 이전 스케줄이 깨끗이 교체되지 않을 수 있음 | ✅ 2차 수정 |
| R2 | 🟠 Medium | `release-apk.yml`에 타입체크 게이트 없음 | ✅ 2차 수정 |
| R3 | 🟠 Medium | 배터리 최적화 직접 요청 권한 — Play 정책 리스크 | ⏸ 보류(Play 배포 전제) |
| R4 | 🟡 Low | daily 워커가 실행 중 동일 unique work를 REPLACE (레이스 여지) | ⏸ 모니터링 |
| R5 | 🟡 Low | 미사용 FileProvider | ⏸ 보류 |
| R6 | 🟡 Low | `allowBackup="true"` | ⏸ 보류 |
| R7 | 🟡 Low | cleartext 전역 허용 | ⏸ 보류 |
| R8 | 🟡 Low | 실제 테스트 부재 (템플릿 스텁만) | ✅ 3차 수정 |
| R9 | 🟡 Low | `versionCode` 고정(1) — 릴리스 자동 증가 없음 | ✅ 3차 수정 |
| R10 | 🟡 Low | 다운샘플 조건/원본 전량 메모리 적재의 엣지 | ⏸ 보류 |

### ✅ 2차 수정 내역
- **R1** — `WallpaperPlugin.schedule()`에서 enqueue 직전 `wm.cancelUniqueWork(workName)`를 호출해, daily↔interval 모드 전환 시 이전 작업 유형과 무관하게 기존 스케줄을 확실히 취소 후 재등록. (이전 OneTimeWork 체인 잔존/중복 발화 제거)
- **R2** — `release-apk.yml` build 단계 앞에 `npm run typecheck` 게이트 추가. 이제 Debug·Release 두 워크플로 모두 타입검사 통과 후에만 빌드.

### ✅ 3차 수정 내역
- **R9** — `app/build.gradle`이 `-PvCode`/`-PvName` Gradle 프로퍼티를 읽도록 변경(없으면 로컬 기본값 1 / "1.0"). `release-apk.yml`이 태그명(`v1.2.3`→`1.2.3`)을 versionName, `github.run_number`를 versionCode로 주입 → 릴리스마다 버전이 자동 증가하여 업데이트 배포 가능.
- **R8** — Android 비의존 순수 로직을 `ScheduleMath`로 분리(`secondsUntilNextDaily`, `calcInSampleSize`)하고 `WallpaperWorker`/`WallpaperHelper`가 위임. JVM 단위 테스트 `ScheduleMathTest`(시각 경계·자정 넘김·다운샘플 경계 7케이스) 추가. `build-apk.yml`에 `testDebugUnitTest` 단계 추가.
- **검증**: `npm run typecheck` 통과, 두 워크플로 YAML 유효성 확인, ScheduleMath 7개 케이스 독립 JVM 실행으로 전부 PASS(실제 JUnit은 CI에서 실행).

---

## 🟠 Medium

### R1. daily ↔ interval 모드 전환 시 이전 스케줄이 잔존할 수 있음  ✅ 해결됨
- **위치**: `src/App.tsx` `scheduleNative()` → `WallpaperPlugin.java schedule()`
- **현상**: 같은 소스(`workName = wallsync_<id>`)에서
  - interval 등록: `enqueueUniquePeriodicWork(name, ExistingPeriodicWorkPolicy.UPDATE, periodic)`
  - daily 등록: `enqueueUniqueWork(name, ExistingWorkPolicy.REPLACE, oneTime)`
  를 사용합니다. **daily(OneTimeWork 체인) → interval로 전환**할 때 `enqueueUniquePeriodicWork(UPDATE)`는 주기 작업 갱신용이라, 같은 이름에 걸려 있던 OneTimeWork 체인을 확실히 취소한다는 보장이 약합니다. 마지막으로 예약된 daily OneTimeWork가 한 번 더 발화하거나 두 스케줄이 잠시 공존할 가능성이 있습니다.
  - (반대로 interval → daily는 `REPLACE`라 기존을 취소하므로 안전)
- **영향**: 모드를 바꿔 저장한 직후 의도치 않은 추가 적용 1회 또는 중복 예약.
- **권장**: 재등록 직전 항상 `cancelUniqueWork(name)` 호출 후 enqueue, 또는 두 경로 모두 `REPLACE` 계열로 통일.

### R2. 릴리스 워크플로에 타입체크 게이트 없음  ✅ 해결됨
- **위치**: `.github/workflows/release-apk.yml` (35~37행: `npm ci` → `npm run build`로 바로 진행)
- **현상**: 1차 수정에서 `build-apk.yml`에는 `npm run typecheck`를 추가했지만 `release-apk.yml`에는 없습니다. 태그 push로 만드는 **서명 릴리스 APK는 타입 검사를 건너뜁니다.**
- **권장**: `release-apk.yml`의 build 단계 앞에도 동일하게 `npm run typecheck` 추가.

### R3. 배터리 최적화 직접 요청 권한 (Play 정책)
- **위치**: `AndroidManifest.xml` `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `WallpaperPlugin.java requestIgnoreBatteryOptimizations()`
- **현상**: `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 직접 요청은 Play 제한 권한으로, 배경화면 앱은 허용 사례에 해당하지 않을 가능성이 큼 → 정식 배포 시 심사 거절 위험. (사이드로드 Debug APK에는 영향 없어 현재 보류 상태)
- **권장**: Play Store 배포 시 직접 요청 인텐트 제거하고 `openBatterySettings()` 안내만 사용(폴백 경로는 이미 존재).

---

## 🟡 Low

### R4. daily self-reschedule가 실행 중 동일 unique work를 REPLACE
- **위치**: `WallpaperWorker.java rescheduleDaily()` — `enqueueUniqueWork(workName, REPLACE, next)`
- **현상**: 워커가 자신과 동일한 unique work 이름으로 REPLACE 재등록합니다. 현재 실행이 곧 `Result.success()`로 끝나므로 일반적으로 문제없지만, REPLACE가 "실행 중"인 자기 작업을 취소 대상으로 보는 드문 레이스 여지가 있습니다.
- **권장**: 동작 모니터링. 이슈 발생 시 재예약을 워커 종료 후 트리거하거나 `KEEP` 정책 검토.

### R5. 미사용 FileProvider 선언
- **위치**: `AndroidManifest.xml` `provider`, `res/xml/file_paths.xml`
- 파일 공유 로직이 없는 템플릿 잔재. 동작 무해하나 불필요한 노출면. 제거 권장.

### R6. `allowBackup="true"`
- **위치**: `AndroidManifest.xml`
- WebView localStorage(소스 목록)가 Android 자동 백업 대상. 의도와 다르면 `false` 또는 백업 규칙 명시.

### R7. cleartext(평문 HTTP) 전역 허용
- **위치**: `AndroidManifest.xml` `usesCleartextTraffic="true"`, `capacitor.config.ts allowMixedContent`
- **현상**: #3 해결을 위해 전역 cleartext를 허용한 상태. 기능은 정상이나 보안상 평문 트래픽이 앱 전체에 허용됨.
- **권장**: 보안 강화가 필요하면 `network-security-config`로 특정 도메인만 cleartext 허용하도록 좁히기.

### R8. 실제 테스트 부재  ✅ 해결됨
- **위치**: `ExampleUnitTest.java`, `ExampleInstrumentedTest.java` (Capacitor 템플릿 스텁)
- 스케줄 시각 계산(`secondsUntilNextDaily`), 다운샘플 계산(`calcInSampleSize`) 등 순수 로직에 대한 단위 테스트가 없음. 회귀 방지를 위해 최소한의 JVM 단위 테스트 추가 권장.

### R9. `versionCode`/`versionName` 고정  ✅ 해결됨
- **위치**: `android/app/build.gradle` (`versionCode 1`, `versionName "1.0"`)
- 릴리스마다 수동 증가 필요. 태그 기반 자동 주입(예: `github.ref_name` → versionName, run number → versionCode) 부재.

### R10. 다운샘플 조건 및 원본 전량 메모리 적재 엣지
- **위치**: `WallpaperHelper.java calcInSampleSize()` / `download()`
- **현상**:
  1. `calcInSampleSize`가 `(w/sample > reqW*2) && (h/sample > reqH*2)` — **AND** 조건이라 한 축만 매우 큰 극단적 종횡비 이미지는 다운샘플되지 않을 수 있음.
  2. 다운샘플 2-pass를 위해 원본 응답을 `byte[]`로 전량 메모리에 적재 → 초대형 파일에서 일시적 메모리 사용 증가.
- **영향**: 일반 배경화면(세로 이미지)에서는 문제없음. 비정상 입력에서만 엣지.
- **권장**: 필요 시 OR 조건/상한(maxBytes) 가드 추가.

---

## 검증 메모
- 현재 `npm run typecheck` / `npm run build` 통과 상태(1차 수정 시 확인).
- 네이티브 변경은 GitHub Actions 빌드에서 컴파일 검증 필요(로컬 Android SDK 미보유).

## 우선순위 제안
1. **R1, R2** — 모드 전환 정확성 + 릴리스 품질 게이트. 비교적 작은 변경으로 처리 가능.
2. **R3** — Play 배포 착수 시점에 필수.
3. 나머지(R4~R10) — 보안 강화·테스트·릴리스 자동화 단계에서 정리.
