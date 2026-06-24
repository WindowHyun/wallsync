# WallSync 점검 리포트 (수정 필요 사항)

> 대상 브랜치: `claude/review-report-checklist-i2sus1`
> 점검일: 2026-06-24
> 범위: 웹(React/TS) + 네이티브(Android/Java) + 빌드/CI 전체
> **본 리포트는 코드 수정 없이 점검 결과만 정리한 문서입니다.**

---

## 요약

| 심각도 | 개수 | 항목 |
|--------|------|------|
| 🔴 High (기능 결함) | 3 | #1 자동 갱신 대상(target) 불일치, #2 매일 예약 시각 드리프트, #3 cleartext(http) URL 다운로드 실패 |
| 🟠 Medium | 4 | #4 대용량 이미지 OOM 위험, #5 배터리 최적화 권한 Play 정책, #6 미리보기 dim 상태 잔존, #7 CI 타입체크 누락 |
| 🟡 Low | 6 | #8~#13 (아래) |

---

## 🔴 High — 기능 결함

### #1 자동 갱신 예약 후 적용 대상(target)을 바꿔도 백그라운드 작업에 반영되지 않음
- **위치**: `src/App.tsx:379-380` (`handleTarget`), `src/App.tsx:382-402` (`handleSchedSave`)
- **현상**: 카드의 `TargetPicker`로 적용 대상(홈/잠금/둘 다)을 변경하면 `handleTarget`이 React state만 갱신하고, 이미 예약된 WorkManager 작업(`Wallpaper.schedule`)은 다시 등록하지 않습니다.
- **결과**: 자동 갱신이 켜진(`auto=true`) 소스에서 사용자가 대상을 "홈"→"둘 다"로 바꿔도, 백그라운드 갱신은 계속 예전 대상("홈")으로 적용됩니다. 화면 표시값과 실제 동작이 어긋납니다.
- **수정 방향**: `handleTarget`에서 해당 소스가 `auto`인 경우 `Wallpaper.schedule`을 재호출해 최신 `target`으로 재등록.

### #2 "매일 HH:MM" 예약이 첫 실행만 정시이고 이후 시각이 드리프트됨
- **위치**: `src/App.tsx:388-393` (daily → `intervalMinutes: 1440 + initialDelaySeconds`)
- **현상**: 매일 예약을 `PeriodicWorkRequest(interval=1440분)` + `initialDelay`로 구현. WorkManager 주기 작업의 `initialDelay`는 **첫 실행에만** 적용되며, 이후 실행은 24시간 주기 윈도우 내 임의 시점에 일어납니다(flex = 전체 주기).
- **결과**: "매일 08:00"로 설정해도 정확히 08:00에 맞는 건 첫 회뿐이고, 이후에는 실행 지연·도즈 모드 등으로 매번 실행 시각이 하루 중 여기저기로 점점 어긋납니다. UI 라벨(`매일 08:00`)과 실제 동작이 불일치합니다.
- **수정 방향**: `OneTimeWorkRequest`로 매 실행 후 다음 08:00을 다시 예약(self-reschedule)하는 방식, 또는 `PeriodicWorkRequest`에 짧은 flex를 주고 매 회 실행 시 시각 검증.

### #3 사용자가 입력한 `http://` 이미지 URL은 네이티브 다운로드가 실패함 (cleartext 차단)
- **위치**: `android/app/src/main/AndroidManifest.xml` (cleartext 허용 설정 없음), `android/app/src/main/java/com/wallsync/app/WallpaperHelper.java:27` (`HttpURLConnection`)
- **현상**: targetSdk 28+ 에서는 평문(HTTP) 트래픽이 기본 차단됩니다. 매니페스트에 `android:usesCleartextTraffic="true"`나 network-security-config가 없습니다.
- **함정**: `capacitor.config.ts:14`의 `allowMixedContent: true`는 **WebView**에만 적용되므로 추가 모달의 미리보기 이미지는 보일 수 있지만, 실제 적용 시 네이티브 `HttpURLConnection`은 `http://` URL에서 예외가 발생합니다 → 미리보기는 되는데 적용은 실패하는 혼란스러운 UX.
- **수정 방향**: (a) `http` URL 입력을 막거나 경고, 또는 (b) network-security-config로 cleartext 허용 정책 명시.

---

## 🟠 Medium

### #4 이미지 디코딩 시 다운샘플링이 없어 대용량(QHD 등) 이미지에서 OOM 위험
- **위치**: `android/app/src/main/java/com/wallsync/app/WallpaperHelper.java:40` (`BitmapFactory.decodeStream(in)`)
- **현상**: `inSampleSize`/크기 제한 없이 원본을 통째로 디코딩 후 `setBitmap`. KBO QHD(1440×3120) 등 큰 이미지 + 저사양 기기에서 `OutOfMemoryError` 가능. 또한 `WallpaperManager.getDesiredMinimumWidth/Height` 대비 과도하게 큰 비트맵은 예외를 던질 수 있습니다.
- **수정 방향**: `BitmapFactory.Options.inJustDecodeBounds`로 크기 측정 후 화면/희망 크기에 맞춰 `inSampleSize` 적용.

### #5 `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 직접 요청은 Google Play 정책상 거절 위험
- **위치**: `android/app/src/main/AndroidManifest.xml:43`, `WallpaperPlugin.java:113-124` (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`)
- **현상**: 해당 권한/인텐트는 Play의 제한 권한입니다. 배경화면 자동 갱신은 허용 사용 사례에 해당하지 않을 가능성이 커서 Play Store 심사에서 거절될 수 있습니다. (사이드로드 Debug APK 배포에는 영향 없음)
- **수정 방향**: 정식 배포 시 직접 요청 인텐트 제거하고 `openBatterySettings()`(설정 화면 안내)만 사용하는 우회 경로 유지.

### #6 미리보기/카드 이미지의 dim(흐림) 상태가 성공 로드 후에도 잔존
- **위치**: `src/App.tsx:195` (AddModal `onError`), `src/App.tsx:302` (SourceCard `onError`)
- **현상**: 로드 실패 시 `e.target.style.opacity = "0.25"`로 DOM을 직접 변경합니다. 이후 옵션을 바꿔 정상 이미지로 `src`가 바뀌어도 React style prop은 그대로라 opacity가 0.25로 남아, 정상 이미지가 계속 흐리게 보입니다.
- **수정 방향**: `onLoad`에서 opacity를 1로 복원하거나, 에러 상태를 React state로 관리하고 `img`에 `key={src}` 부여.

### #7 CI에 타입체크/린트 게이트 없음
- **위치**: `.github/workflows/build-apk.yml` (빌드만 수행), `package.json:8` (`typecheck` 스크립트는 존재하나 미사용)
- **현상**: `npm run build`(vite)는 타입 오류가 있어도 통과될 수 있고, 워크플로에서 `tsc --noEmit`를 호출하지 않습니다. 타입 회귀가 그대로 머지될 수 있습니다.
- **수정 방향**: build 단계 앞에 `npm run typecheck` 추가.

---

## 🟡 Low

### #8 미사용 FileProvider 선언 (템플릿 잔재)
- **위치**: `AndroidManifest.xml:27-35`, `res/xml/file_paths.xml`
- 파일 공유 로직이 없는데 FileProvider가 선언되어 있습니다. 동작에는 무해하나 불필요한 attack surface/노이즈.

### #9 `allowBackup="true"` 로 로컬 데이터가 자동 백업됨
- **위치**: `AndroidManifest.xml:5`
- WebView localStorage(소스 목록)가 Android 자동 백업 대상이 됩니다. 의도된 것이 아니라면 명시적으로 검토 필요.

### #10 `work-runtime` 버전만 하드코딩되어 버전 관리 일관성 깨짐
- **위치**: `android/app/build.gradle:59` (`"androidx.work:work-runtime:2.9.1"`)
- 다른 의존성은 `variables.gradle`의 변수를 쓰는데 이것만 리터럴. `variables.gradle`로 통일 권장.

### #11 `uid()` 충돌 가능성 (이론상)
- **위치**: `src/App.tsx:57` (`Math.random().toString(36).slice(2,9)`)
- 7자 난수로 소스 ID와 WorkManager 고유 작업명(`wallsync_<id>`)을 만듭니다. 충돌 확률은 낮지만 0은 아니며, 충돌 시 예약이 덮어써집니다. `crypto.randomUUID()` 권장.

### #12 README와 실제 워크플로 트리거 불일치
- **위치**: `README.md:23` ("main에 push하면"), `.github/workflows/build-apk.yml:4-8` (push/PR/`workflow_dispatch` 모두)
- 문서는 main push만 언급하나 실제로는 PR에서도 빌드됩니다. 문서 보강 권장.

### #13 `capacitor.config.ts`의 `allowMixedContent: true`
- **위치**: `capacitor.config.ts:14`
- WebView에서 https 컨텍스트에 http 리소스 로드를 허용 → 경미한 보안 약화. #3과 함께, 미리보기만 되고 적용은 실패하는 불일치의 원인.

---

## 점검했으나 문제 없는 항목
- `WallpaperHelper`의 connection/stream `finally` 정리 — 올바름.
- `WallpaperWorker`의 실패 시 `Result.retry()` — 적절.
- 플러그인 등록(`MainActivity`에서 `super.onCreate` 이전 `registerPlugin`) — Capacitor 권장 패턴.
- minSdk 24에서 `setBitmap(..., which)` 사용 — API 24+ 요구사항 충족(주석도 정확).
- keystore `.gitignore` 처리 — 안전.

---

## 우선순위 제안
1. **#1, #2** — 핵심 기능(자동 갱신)의 정확성 결함이므로 최우선.
2. **#3** — 직접 URL 기능의 실사용 실패. 입력 검증만으로도 빠른 완화 가능.
3. **#4, #5** — 안정성/배포(Play) 리스크.
4. 나머지(#6~#13) — 품질·문서 개선.
