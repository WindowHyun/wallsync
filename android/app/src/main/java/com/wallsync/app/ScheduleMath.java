package com.wallsync.app;

import java.util.Calendar;

/**
 * 안드로이드 프레임워크에 의존하지 않는 순수 계산 로직.
 * (JVM 단위 테스트로 결정적으로 검증하기 위해 분리)
 */
final class ScheduleMath {

    private ScheduleMath() {}

    /** base 기준, 다음 hour:minute 까지 남은 초. 현재 시각이 이미 지났으면 다음 날. */
    static long secondsUntilNextDaily(Calendar base, int hour, int minute) {
        Calendar next = (Calendar) base.clone();
        next.set(Calendar.HOUR_OF_DAY, hour);
        next.set(Calendar.MINUTE, minute);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (!next.after(base)) {
            next.add(Calendar.DAY_OF_MONTH, 1);
        }
        long diffMs = next.getTimeInMillis() - base.getTimeInMillis();
        return Math.max(0, diffMs / 1000);
    }

    /** 원본(w×h)이 요청 크기보다 클 때 2의 거듭제곱 샘플 비율을 계산. */
    static int calcInSampleSize(int w, int h, int reqW, int reqH) {
        int sample = 1;
        if (w <= 0 || h <= 0) return sample;
        while ((w / sample) > reqW * 2 && (h / sample) > reqH * 2) {
            sample *= 2;
        }
        return sample;
    }
}
