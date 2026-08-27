export type SleepInterval = {
  started_at: number;
  /** null이면 진행 중. */
  ended_at: number | null;
};

/**
 * 주어진 구간과 겹치는 수면 시간의 합.
 *
 * 수면은 구간이라 하루에 걸치는 일이 흔하다. 전체 길이를 그대로 더하면
 * 전날 몫까지 오늘에 들어간다. 경계와 겹치는 부분만 잘라서 센다.
 *
 * 진행 중인 수면(`ended_at === null`)의 종료는 `now`로 본다. 구간 끝이 아니다 —
 * 아직 오지 않은 시간을 잤다고 셀 수는 없다.
 *
 * `now`는 인자로 받는다. 안에서 `Date.now()`를 부르면 진행 중 수면의 결과가
 * 실행 시각에 따라 달라져 테스트로 고정할 수 없다.
 */
export function calculateSleepDuration(
  sleeps: SleepInterval[],
  rangeStart: number,
  rangeEnd: number,
  now: number
): number {
  let total = 0;
  for (const sleep of sleeps) {
    const end = Math.min(sleep.ended_at ?? now, rangeEnd);
    const start = Math.max(sleep.started_at, rangeStart);
    total += Math.max(0, end - start);
  }
  return total;
}
