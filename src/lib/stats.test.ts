import {
  barDayLabel,
  barValueLabel,
  sleepMinutesLabel,
  sleepMsByDay,
  toBars,
} from './stats';

describe('toBars', () => {
  it('그 지표의 최댓값을 1로 잡는다', () => {
    expect(toBars([2, 4, 8]).map((b) => b.ratio)).toEqual([0.25, 0.5, 1]);
  });

  it('모든 값에 같은 배율을 곱해도 막대 비율은 같다', () => {
    const counts = toBars([2, 8]);
    const sleepMs = toBars([2 * 3_600_000, 8 * 3_600_000]);
    expect(counts.map((b) => b.ratio)).toEqual(sleepMs.map((b) => b.ratio));
  });

  it('모두 0이면 나누지 않고 높이가 0이다', () => {
    expect(toBars([0, 0, 0]).map((b) => b.ratio)).toEqual([0, 0, 0]);
  });

  it('모두 기록 없음이어도 높이가 0이다', () => {
    expect(toBars([null, null]).map((b) => b.ratio)).toEqual([0, 0]);
  });

  it('빈 목록도 던지지 않는다', () => {
    expect(toBars([])).toEqual([]);
  });

  it('기록 없음은 최댓값 계산에서 빠진다', () => {
    expect(toBars([null, 5, 10]).map((b) => b.ratio)).toEqual([0, 0.5, 1]);
  });

  it('0과 기록 없음은 막대가 둘 다 없어도 값으로 구분된다', () => {
    // 높이만 보면 같지만 숫자 라벨에서 `0`과 `—`로 갈려야 한다.
    const [zero, missing] = toBars([0, null]);
    expect(zero.ratio).toBe(missing.ratio);
    expect(zero.value).toBe(0);
    expect(missing.value).toBeNull();
  });

  it('NaN이나 Infinity가 섞여도 나머지 막대가 멀쩡하다', () => {
    // 한쪽만 막으면 그 값 자신의 비율이 새어 나간다. 최댓값 계산과 비율 계산
    // 양쪽에서 걸러야 `ratio`가 0~1 안에 남는다.
    expect(toBars([NaN, 5]).map((b) => b.ratio)).toEqual([0, 1]);
    expect(toBars([Infinity, 5]).map((b) => b.ratio)).toEqual([0, 1]);
  });

  it('음수가 섞여도 비율이 0 미만으로 내려가지 않는다', () => {
    // 횟수·수유량·수면은 모두 0 이상이라 나올 일이 없다. 그래도 막대가 축 아래로
    // 뻗으면 화면이 깨지므로 0으로 눕힌다.
    expect(toBars([-1, 5]).map((b) => b.ratio)).toEqual([0, 1]);
    expect(toBars([-1, 0]).map((b) => b.ratio)).toEqual([0, 0]);
    expect(toBars([-3, -1]).map((b) => b.ratio)).toEqual([0, 0]);
  });
});

describe('barValueLabel', () => {
  const plain = (n: number) => `${n}`;

  it('기록이 없으면 `—`다', () => {
    expect(barValueLabel(null, plain)).toBe('—');
  });

  it('0회는 `0`이다', () => {
    // 막대는 둘 다 없다. 숫자가 유일한 단서다.
    expect(barValueLabel(0, plain)).toBe('0');
  });

  it('값 포맷은 지표가 정한다', () => {
    expect(barValueLabel(3_600_000, (ms) => `${ms / 3_600_000}시간`)).toBe('1시간');
  });
});

describe('sleepMinutesLabel', () => {
  it('분 단위로 버린다', () => {
    expect(sleepMinutesLabel(12 * 60_000)).toBe('12');
    expect(sleepMinutesLabel(12 * 60_000 + 59_000)).toBe('12');
    expect(sleepMinutesLabel(700 * 60_000)).toBe('700');
  });

  it('1분 미만은 올리지도 내리지도 않는다', () => {
    // `1`로 올리면 없는 시간을 더하고, `0`으로 내리면 기록 없음과 같아 보인다.
    expect(sleepMinutesLabel(1)).toBe('<1');
    expect(sleepMinutesLabel(59_999)).toBe('<1');
    expect(sleepMinutesLabel(60_000)).toBe('1');
  });

  it('0은 그대로 0이다', () => {
    expect(sleepMinutesLabel(0)).toBe('0');
  });
});

describe('barDayLabel', () => {
  const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

  it('오늘은 날짜 대신 `오늘`이다', () => {
    const today = day(2026, 9, 18);
    expect(barDayLabel(today, today)).toBe('오늘');
  });

  it('나머지는 월/일이다', () => {
    expect(barDayLabel(day(2026, 9, 12), day(2026, 9, 18))).toBe('9/12');
    expect(barDayLabel(day(2026, 12, 1), day(2026, 12, 7))).toBe('12/1');
  });
});

describe('sleepMsByDay', () => {
  const HOUR = 3_600_000;
  const at = (d: number, h: number) => new Date(2026, 8, d, h).getTime();
  const days = [11, 12, 13].map((d) => ({ start: at(d, 0), end: at(d + 1, 0) }));

  it('겹치는 기록이 없는 날은 0이 아니라 null이다', () => {
    // 안 잔 것과 기록하지 않은 것은 다르다.
    expect(sleepMsByDay([], days, at(13, 12))).toEqual([null, null, null]);
  });

  it('자정을 넘는 수면을 날짜별로 자른다', () => {
    const sleeps = [{ started_at: at(11, 23), ended_at: at(12, 6) }];
    expect(sleepMsByDay(sleeps, days, at(13, 12))).toEqual([HOUR, 6 * HOUR, null]);
  });

  it('하루를 통째로 덮는 수면도 그날 몫만 센다', () => {
    const sleeps = [{ started_at: at(11, 20), ended_at: at(13, 4) }];
    expect(sleepMsByDay(sleeps, days, at(13, 12))).toEqual([4 * HOUR, 24 * HOUR, 4 * HOUR]);
  });

  it('겹치는 기록끼리는 합집합으로 센다', () => {
    // 시각을 수정해 겹치게 만들 수 있다. 그대로 더하면 이중으로 센다.
    const sleeps = [
      { started_at: at(12, 1), ended_at: at(12, 4) },
      { started_at: at(12, 3), ended_at: at(12, 5) },
    ];
    expect(sleepMsByDay(sleeps, days, at(13, 12))[1]).toBe(4 * HOUR);
  });

  it('진행 중인 수면은 모든 날짜에 같은 now를 쓴다', () => {
    const sleeps = [{ started_at: at(12, 22), ended_at: null }];
    const now = at(13, 2);
    expect(sleepMsByDay(sleeps, days, now)).toEqual([null, 2 * HOUR, 2 * HOUR]);
  });

  it('범위 밖 기록은 세지 않는다', () => {
    const sleeps = [{ started_at: at(9, 1), ended_at: at(9, 3) }];
    expect(sleepMsByDay(sleeps, days, at(13, 12))).toEqual([null, null, null]);
  });

  it('경계에서 끝난 수면은 다음 날에 들어가지 않는다', () => {
    // `ended_at === range.start`는 겹침이 아니다. SQL의 `ended_at > ?`와 같다.
    const sleeps = [{ started_at: at(11, 22), ended_at: at(12, 0) }];
    expect(sleepMsByDay(sleeps, days, at(13, 12))).toEqual([2 * HOUR, null, null]);
  });
});
