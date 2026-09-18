import { recentDayRanges } from './time';

/**
 * 7일 경계는 서머타임에서 깨지기 쉽다. 한국은 서머타임이 없어 KST로는 아무것도
 * 증명하지 못하므로 `npm run test:dst`가 `TZ=America/New_York`로 따로 돌린다.
 */

const HOUR = 3_600_000;
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const lengthOf = (now: Date) => {
  const [day] = recentDayRanges(now, 1);
  return day.end - day.start;
};

describe('recentDayRanges — 서머타임', () => {
  it('서머타임이 있는 지역에서 돌고 있다', () => {
    // KST로 돌면 아래 검사가 조용히 통과해 버린다. 환경부터 확인한다.
    expect(new Date(2026, 0, 1).getTimezoneOffset()).not.toBe(
      new Date(2026, 6, 1).getTimezoneOffset()
    );
  });

  it('봄에 시계를 당기는 날은 23시간이다', () => {
    expect(lengthOf(at(2026, 3, 8))).toBe(23 * HOUR);
  });

  it('가을에 시계를 되돌리는 날은 25시간이다', () => {
    expect(lengthOf(at(2026, 11, 1))).toBe(25 * HOUR);
  });

  it('전환일을 지나도 경계가 맞물린다', () => {
    // `시작 + 86400000`으로 만들면 여기서 틈이나 겹침이 생긴다.
    for (const now of [at(2026, 3, 10), at(2026, 11, 3)]) {
      const ranges = recentDayRanges(now, 7);
      for (let i = 1; i < ranges.length; i++) {
        expect(ranges[i].start).toBe(ranges[i - 1].end);
      }
    }
  });

  it('전환일이 섞여도 7일은 7일이다', () => {
    const ranges = recentDayRanges(at(2026, 3, 10), 7);
    const total = ranges[ranges.length - 1].end - ranges[0].start;
    expect(total).toBe(7 * 24 * HOUR - HOUR);
  });
});
