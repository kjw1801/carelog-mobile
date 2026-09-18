import { recentDayRanges, todayRange } from './time';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe('recentDayRanges', () => {
  it('요청한 개수만큼 돌려준다', () => {
    expect(recentDayRanges(at(2026, 9, 18), 7)).toHaveLength(7);
  });

  it('과거부터 오늘 순이고 마지막이 오늘이다', () => {
    const now = at(2026, 9, 18);
    const ranges = recentDayRanges(now, 7);
    expect(ranges[ranges.length - 1]).toEqual(todayRange(now));
    expect(new Date(ranges[0].start).getDate()).toBe(12);
  });

  it('하루의 끝이 다음 날의 시작과 맞물린다', () => {
    // 틈이 생기면 그 사이 기록이 어느 막대에도 안 들어간다.
    const ranges = recentDayRanges(at(2026, 9, 18), 7);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].start).toBe(ranges[i - 1].end);
    }
  });

  it('월 경계를 넘는다', () => {
    const ranges = recentDayRanges(at(2026, 3, 2), 7);
    expect(new Date(ranges[0].start).getMonth() + 1).toBe(2);
    expect(new Date(ranges[0].start).getDate()).toBe(24);
  });

  it('연 경계를 넘는다', () => {
    const ranges = recentDayRanges(at(2027, 1, 2), 7);
    expect(new Date(ranges[0].start).getFullYear()).toBe(2026);
    expect(new Date(ranges[0].start).getDate()).toBe(27);
  });

  it('윤년 2월 29일을 건너뛰지 않는다', () => {
    const ranges = recentDayRanges(at(2028, 3, 1), 3);
    expect(new Date(ranges[1].start).getDate()).toBe(29);
    expect(new Date(ranges[1].start).getMonth() + 1).toBe(2);
  });

  it('하루 중 언제 물어도 같은 경계다', () => {
    const early = recentDayRanges(at(2026, 9, 18, 0), 7);
    const late = recentDayRanges(at(2026, 9, 18, 23), 7);
    expect(early).toEqual(late);
  });
});
