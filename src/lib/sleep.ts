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
 * **겹치는 기록은 합치고 나서 더한다.** 진행 중 수면만 하나로 제한할 뿐,
 * 끝난 기록끼리는 시각을 수정해 겹치게 만들 수 있다. 그대로 더하면 겹친 만큼
 * 이중으로 세어 하루에 나올 수 없는 값이 나온다. 실제로 잠들어 있던 시간의
 * 합집합을 센다. 병합하면 결과가 자연히 `rangeEnd - rangeStart` 안에 들어가므로
 * 24시간 같은 상한을 따로 두지 않는다 — 서머타임에서는 하루가 23시간이나
 * 25시간일 수 있어 상한을 숫자로 박으면 그때 틀린다.
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
  // 입력 순서는 보장되지 않는다. 병합하려면 시작 시각 순으로 봐야 한다.
  // 새 배열이라 인자로 받은 목록은 건드리지 않는다.
  const segments = sleeps
    .map((sleep) => ({
      start: Math.max(sleep.started_at, rangeStart),
      end: Math.min(sleep.ended_at ?? now, rangeEnd),
    }))
    .filter((segment) => segment.end > segment.start)
    .sort((a, b) => a.start - b.start);

  let total = 0;
  let mergedStart = 0;
  let mergedEnd = 0;
  let open = false;

  for (const segment of segments) {
    // 경계가 맞닿기만 한 구간(앞의 끝 === 뒤의 시작)도 이어 붙인다.
    // 따로 세든 이어 붙이든 합은 같지만, 하나의 구간으로 두는 편이 단순하다.
    if (open && segment.start <= mergedEnd) {
      mergedEnd = Math.max(mergedEnd, segment.end);
      continue;
    }
    if (open) total += mergedEnd - mergedStart;
    mergedStart = segment.start;
    mergedEnd = segment.end;
    open = true;
  }
  if (open) total += mergedEnd - mergedStart;

  return total;
}
