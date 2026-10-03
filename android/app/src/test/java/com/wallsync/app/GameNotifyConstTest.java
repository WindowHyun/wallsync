package com.wallsync.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * 알림 id 해시 — TS(src/lib/schedule-plan.test.ts)와 같은 고정 벡터를 검증해
 * 두 구현이 어긋나지 않게 한다.
 */
public class GameNotifyConstTest {

    @Test
    public void notifId_matchesTsVectors() {
        assertEquals(981078, GameNotifyConst.notifId("2026-07-1018:30"));
        assertEquals(861821, GameNotifyConst.notifId("2026-07-1014:00"));
        assertEquals(505849, GameNotifyConst.notifId("2026-08-0117:00"));
        assertEquals(100097, GameNotifyConst.notifId("a"));
        assertEquals(100000, GameNotifyConst.notifId(""));
    }

    @Test
    public void notifId_alwaysInRange_evenWhenHashOverflowsToMinValue() {
        // 31진 해시가 음수/MIN_VALUE가 되는 긴 입력에서도 100000~999999
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 200; i++) {
            sb.append((char) ('a' + (i * 7) % 26));
            int id = GameNotifyConst.notifId(sb.toString());
            assertTrue("id=" + id, id >= 100000 && id < 1000000);
        }
    }
}
