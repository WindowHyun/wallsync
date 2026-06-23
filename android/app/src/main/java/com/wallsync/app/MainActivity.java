package com.wallsync.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 커스텀 배경화면 플러그인 등록 (super.onCreate 이전에 호출해야 함)
        registerPlugin(WallpaperPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
