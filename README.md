# WallSync 🖼️
> URL·KBO 배경화면을 등록하고 **실제로 적용 + 자동 갱신**하는 안드로이드 앱

Capacitor(React 웹 → 네이티브 래핑) 기반. URL 이미지를 내려받아 `WallpaperManager`로
홈/잠금 배경화면에 적용하고, `WorkManager`로 주기적으로 다시 받아 자동 갱신합니다.
KBO 월페이퍼 생성기(`kbo-wallpaper.vercel.app`)와 연동해 매일·매달 최신 일정 배경화면이
자동으로 바뀌도록 만드는 것이 주 용도입니다.

---

## ✨ 기능

- **KBO 빌더** — 구단/스타일/모드/해상도를 골라 KBO 배경화면 URL을 자동 생성 (연·월 없는 자동 갱신 URL)
- **직접 URL** — 임의의 이미지 URL 등록
- **지금 적용** — 홈 / 잠금 / 둘 다 대상 선택 후 즉시 배경화면 변경
- **자동 갱신** — N시간마다 또는 매일 특정 시각에 백그라운드로 재적용 (WorkManager, 앱이 꺼져 있어도 동작)
- 등록 목록은 기기 로컬(localStorage)에 저장

---

## 🚀 APK 빌드 (로컬 안드로이드 도구 없이)

`main`에 push하면 GitHub Actions가 자동으로 Debug APK를 빌드합니다.

```
GitHub 저장소 → Actions 탭 → 최근 빌드 클릭
→ 하단 Artifacts → "WallSync-Debug-APK" 다운로드
```

### 설치
1. 받은 ZIP 압축 해제 → `app-debug.apk`
2. 안드로이드 폰으로 전송 (카카오톡/드라이브 등)
3. 설정 → 보안 → **알 수 없는 앱 설치 허용**
4. APK 실행 → 설치

> Debug 빌드는 `com.wallsync.app.debug`로 설치되며 별도 서명 없이 바로 설치됩니다.

---

## 🔧 로컬 개발 (선택)

```bash
npm install
npm run dev          # 웹 미리보기 (배경화면 적용은 동작 안 함 — UI 확인용)
npm run build        # dist/ 생성
npx cap sync android # 안드로이드에 반영
```

실제 APK 빌드/실행에는 Android Studio + SDK가 필요하지만, **위 GitHub Actions를 쓰면
로컬에 Java/Android Studio가 전혀 없어도** APK가 나옵니다.

---

## 🔑 Release(서명) APK — 선택

Play Store 배포용 서명 APK는 태그를 push하면 `release-apk.yml`이 생성합니다.

1. keystore 생성: `keytool -genkey -v -keystore wallsync.keystore -alias wallsync -keyalg RSA -keysize 2048 -validity 10000`
2. 저장소 → Settings → Secrets and variables → Actions 에 등록:

   | Secret | 값 |
   |--------|----|
   | `KEYSTORE_BASE64` | `base64 wallsync.keystore` 결과 |
   | `KEYSTORE_PASSWORD` | keystore 비밀번호 |
   | `KEY_ALIAS` | `wallsync` |
   | `KEY_PASSWORD` | key 비밀번호 |

3. `git tag v1.0.0 && git push origin v1.0.0` → 서명된 APK가 GitHub Release에 첨부됩니다.

---

## 📁 구조

```
wallsync/
├── .github/workflows/
│   ├── build-apk.yml          # push → Debug APK (Artifacts)
│   └── release-apk.yml        # 태그 → 서명 Release APK
├── src/
│   ├── App.tsx                # UI (목록·추가·예약)
│   ├── wallpaper.ts           # 네이티브 플러그인 JS 브릿지
│   └── main.tsx
├── android/                   # Capacitor 안드로이드 플랫폼 (커밋됨)
│   └── app/src/main/java/com/wallsync/app/
│       ├── MainActivity.java      # 플러그인 등록
│       ├── WallpaperPlugin.java   # apply / schedule / cancel
│       ├── WallpaperWorker.java   # 백그라운드 갱신 워커
│       └── WallpaperHelper.java   # URL 다운로드 + WallpaperManager
├── capacitor.config.ts
├── package.json
└── vite.config.ts
```

---

## ⚠️ 참고
- 잠금화면 적용은 기기/제조사(One UI 등)에 따라 제한될 수 있습니다.
- 자동 갱신 최소 간격은 안드로이드 정책상 15분이며, 배터리 절약/도즈 모드에서 실행이 지연될 수 있습니다.
  안정적으로 쓰려면 설정에서 WallSync를 **배터리 최적화 예외**로 두세요.
- 비공식 팬 프로젝트입니다. KBO 데이터 출처: koreabaseball.com
