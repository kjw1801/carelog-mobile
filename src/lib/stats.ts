import { calculateSleepDuration, type SleepInterval } from './sleep';
import { type DayRange } from './time';

/**
 * 막대그래프 계산.
 *
 * 차트 라이브러리를 쓰지 않는다. 막대 높이는 비율 하나면 `View`로 그릴 수 있고,
 * 비율 계산은 순수 함수라 테스트로 고정된다.
 */

/**
 * 하루치 값. `null`은 **기록 없음**이고 `0`과 다르다.
 *
 * 수유·기저귀 횟수는 `0`이 진짜 0이라 `null`이 되지 않는다. 분유량과 수면은
 * 그날 해당하는 기록이 하나도 없으면 `null`이다 — Today 화면의 규칙과 같다.
 */
export type DayValue = number | null;

export type Bar = {
  /** 0~1. 기록이 없거나 그 주의 최댓값이 0이면 0이다. */
  ratio: number;
  /** 원래 값. `null`이면 기록 없음. */
  value: DayValue;
};

const isFiniteValue = (value: DayValue): value is number =>
  value !== null && Number.isFinite(value);

/**
 * 한 지표의 하루치 값들을 막대로 바꾼다.
 *
 * **지표마다 따로 부른다.** 횟수와 밀리초는 단위가 달라 한 최댓값으로 묶으면
 * 큰 쪽만 보이는 그래프가 된다.
 *
 * 최댓값이 `0`이면(모두 0이거나 모두 기록 없음) 나누지 않고 높이를 0으로 둔다.
 *
 * **`ratio`는 어떤 입력에도 0~1 안에 있다.** 음수는 0으로 눕히고, `NaN`·`Infinity`는
 * 최댓값 계산과 비율 계산 **양쪽에서** 거른다. 한쪽만 막으면 그 값 자신의 비율이
 * `NaN`이나 `Infinity`로 새어 나가고, 막대 높이로 쓰이므로 레이아웃이 깨진다.
 */
export function toBars(values: DayValue[]): Bar[] {
  const max = values.reduce<number>(
    (current, value) => (isFiniteValue(value) ? Math.max(current, value) : current),
    0
  );
  return values.map((value) => ({
    value,
    ratio: !isFiniteValue(value) || max <= 0 ? 0 : Math.max(0, value / max),
  }));
}

/**
 * 막대 아래 날짜.
 *
 * 오늘은 아직 끝나지 않은 하루라 날짜 대신 `오늘`로 둔다. 다른 막대와 같은
 * 기준으로 읽으면 "오늘이 유독 적다"로 오해한다.
 */
export function barDayLabel(start: number, todayStart: number): string {
  if (start === todayStart) return '오늘';
  const d = new Date(start);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 날짜별 수면 시간.
 *
 * 수면은 구간이라 하루에 걸치는 일이 흔하다. 날짜마다 따로 조회하지 않고 **전체
 * 범위를 한 번 받아** 날짜별로 자른다. 자르고 겹치는 구간을 병합하는 일은
 * `calculateSleepDuration`이 이미 한다.
 *
 * 그날과 겹치는 기록이 하나도 없으면 `0`이 아니라 `null`이다 — 안 잔 것과
 * 기록하지 않은 것은 다르다. Today 화면과 같은 규칙이다.
 *
 * `now`는 모든 날짜에 같은 값을 쓴다. 날짜마다 다시 읽으면 진행 중인 수면이
 * 날짜별로 조금씩 다른 시각까지 계산돼 합계가 어긋난다.
 */
export function sleepMsByDay(
  sleeps: SleepInterval[],
  ranges: DayRange[],
  now: number
): DayValue[] {
  return ranges.map((range) => {
    // SQL의 겹침 조건과 같아야 한다. 한쪽만 바뀌면 조회에는 있는데 화면에서
    // 빠지는 기록이 생긴다.
    const overlapping = sleeps.filter(
      (sleep) =>
        sleep.started_at < range.end && (sleep.ended_at === null || sleep.ended_at > range.start)
    );
    if (overlapping.length === 0) return null;
    return calculateSleepDuration(overlapping, range.start, range.end, now);
  });
}
