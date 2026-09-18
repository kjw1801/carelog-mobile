import { barDayLabel, toBars } from './stats';

describe('toBars', () => {
  it('그 지표의 최댓값을 1로 잡는다', () => {
    expect(toBars([2, 4, 8]).map((b) => b.ratio)).toEqual([0.25, 0.5, 1]);
  });

  it('지표마다 따로 부르므로 단위가 섞이지 않는다', () => {
    // 횟수 8회와 수면 8시간이 같은 최댓값을 쓰면 큰 쪽만 보이는 그래프가 된다.
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

  it('음수가 섞여도 비율이 0 미만으로 내려가지 않는다', () => {
    // 횟수·수유량·수면은 모두 0 이상이라 나올 일이 없다. 그래도 막대가 축 아래로
    // 뻗으면 화면이 깨지므로 0으로 눕힌다.
    expect(toBars([-1, 5]).map((b) => b.ratio)).toEqual([0, 1]);
    expect(toBars([-1, 0]).map((b) => b.ratio)).toEqual([0, 0]);
    expect(toBars([-3, -1]).map((b) => b.ratio)).toEqual([0, 0]);
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
