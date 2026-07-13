package com.wallsync.app;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

import java.util.Calendar;

/**
 * ScheduleMath 순수 로직 단위 테스트 (Android 프레임워크 비의존).
 * 자동 갱신 시각 계산/다운샘플 비율의 경계 조건 회귀를 방지한다.
 */
public class ScheduleMathTest {

    private static Calendar at(int hour, int minute) {
        Calendar c = Calendar.getInstance();
        c.clear();
        c.set(2026, Calendar.JUNE, 24, hour, minute, 0);
        return c;
    }

    // ── secondsUntilNextDaily ─────────────────────────────────────────────

    @Test
    public void daily_laterToday_returnsDiffWithinSameDay() {
        // 10:00 기준 14:30 → 4시간30분 = 16200초
        assertEquals(16200L, ScheduleMath.secondsUntilNextDaily(at(10, 0), 14, 30));
    }

    @Test
    public void daily_alreadyPassed_rollsToNextDay() {
        // 10:00 기준 08:00 → 다음 날 08:00 = 22시간 = 79200초
        assertEquals(79200L, ScheduleMath.secondsUntilNextDaily(at(10, 0), 8, 0));
    }

    @Test
    public void daily_exactlyNow_rollsToNextDay() {
        // 10:00 기준 10:00 → after()가 아니므로 다음 날 = 86400초
        assertEquals(86400L, ScheduleMath.secondsUntilNextDaily(at(10, 0), 10, 0));
    }

    @Test
    public void daily_aroundMidnight() {
        // 23:30 기준 00:10 → 다음 날 00:10 = 40분 = 2400초
        assertEquals(2400L, ScheduleMath.secondsUntilNextDaily(at(23, 30), 0, 10));
    }

    // ── calcInSampleSize ──────────────────────────────────────────────────

    @Test
    public void sample_smallImage_isOne() {
        assertEquals(1, ScheduleMath.calcInSampleSize(1080, 2400, 1440, 3120));
    }

    @Test
    public void sample_largeImage_downsamples() {
        // 4320×9360 vs 1440×3120 → 양 축 모두 req*2 초과 → 2배 다운샘플
        assertEquals(2, ScheduleMath.calcInSampleSize(4320, 9360, 1440, 3120));
    }

    @Test
    public void sample_invalidDimensions_isOne() {
        assertEquals(1, ScheduleMath.calcInSampleSize(0, 0, 1440, 3120));
        assertEquals(1, ScheduleMath.calcInSampleSize(-1, -1, 1440, 3120));
    }

    @Test
    public void sample_extremeAspectRatio_downsampledByPixelCap() {
        // 10000×2000: 한 축만 매우 큼 → 화면 맞춤(AND) 단계는 미발동이지만
        // 총 픽셀(20M)이 상한(1440*3120*4≈17.97M) 초과 → 픽셀 안전장치로 2배 축소
        assertEquals(2, ScheduleMath.calcInSampleSize(10000, 2000, 1440, 3120));
    }

    // ── notifId — JS 명세(lib/schedule-plan.ts)와의 교차 검증 ─────────────────
    // 기대값은 JS notifId()로 산출한 고정 벡터. schedule-plan.test.ts에 동일 벡터가
    // 있어 양쪽 구현이 같은 계약을 지키는지 회귀 검증한다.

    @Test
    public void notifId_matchesJsSpecVectors() {
        assertEquals(164726, GameNotifyConst.notifId("2026-07-1018:30"));
        assertEquals(210481, GameNotifyConst.notifId("2026-07-1518:30"));
        assertEquals(971480, GameNotifyConst.notifId("2025-03-0114:00"));
        assertEquals(100097, GameNotifyConst.notifId("a"));
        assertEquals(100000, GameNotifyConst.notifId(""));
    }

    @Test
    public void notifId_alwaysInRange() {
        // 해시가 2^31을 넘는 입력(부호 반전 유발)에서도 100000~999999 범위 유지
        String[] samples = { "2026-07-1018:30", "2026-12-3122:00", "긴 문자열로 오버플로를 유도한다 aaaabbbbcccc", "zzzzzzzzzz" };
        for (String s : samples) {
            int id = GameNotifyConst.notifId(s);
            org.junit.Assert.assertTrue("range: " + id, id >= 100000 && id < 1000000);
        }
    }
}
