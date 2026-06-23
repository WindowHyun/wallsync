import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // 앱 고유 ID (나중에 Play Store 등록 시 사용)
  appId: 'com.wallsync.app',
  appName: 'WallSync',

  // React 빌드 결과물 위치
  webDir: 'dist',

  // 안드로이드 전용 설정
  android: {
    // 배경화면 설정 시 필요한 권한들
    allowMixedContent: true,
  },

  server: {
    // 개발 중에만 사용 (배포 시 제거)
    // url: 'http://192.168.x.x:5173',
    // cleartext: true,
  },

  plugins: {
    // 배경화면 설정 플러그인 (추후 네이티브 연동 시)
    // WallpaperPlugin: {}
  },
};

export default config;
