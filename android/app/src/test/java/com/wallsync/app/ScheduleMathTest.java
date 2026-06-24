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
}
