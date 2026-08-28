import { calculateSleepDuration, type SleepInterval } from './sleep';

const HOUR = 60 * 60 * 1000;

// 2026-08-27 00:00 ~ 2026-08-28 00:00 (현지)
const DAY_START = new Date(2026, 7, 27).getTime();
const DAY_END = new Date(2026, 7, 28).getTime();
const NOON = DAY_START + 12 * HOUR;

function sum(sleeps: SleepInterval[], now = NOON): number {
  return calculateSleepDuration(sleeps, DAY_START, DAY_END, now);
}

describe('calculateSleepDuration', () => {
  it('하루 안에 들어오는 수면은 전체 길이를 센다', () => {
    expect(sum([{ started_at: DAY_START + 1 * HOUR, ended_at: DAY_START + 3 * HOUR }])).toBe(
      2 * HOUR
    );
  });

  it('전날 시작한 수면은 자정 이후 몫만 센다', () => {
    // 전날 23:00 → 오늘 06:00 이면 오늘 몫은 6시간이다.
    expect(sum([{ started_at: DAY_START - 1 * HOUR, ended_at: DAY_START + 6 * HOUR }])).toBe(
      6 * HOUR
    );
  });

  it('다음 날까지 이어지는 수면은 자정까지만 센다', () => {
    expect(sum([{ started_at: DAY_END - 2 * HOUR, ended_at: DAY_END + 5 * HOUR }])).toBe(
      2 * HOUR
    );
  });

  it('하루 전체를 덮는 수면은 오늘 구간 전체 길이로 잘린다', () => {
    expect(sum([{ started_at: DAY_START - 5 * HOUR, ended_at: DAY_END + 5 * HOUR }])).toBe(
      DAY_END - DAY_START
    );
  });

  it('진행 중인 수면은 now까지만 센다', () => {
    // 09:00에 시작해 아직 자고 있고 지금이 12:00이면 3시간이다.
    expect(sum([{ started_at: DAY_START + 9 * HOUR, ended_at: null }])).toBe(3 * HOUR);
  });

  it('구간 밖의 수면은 세지 않는다', () => {
    const before: SleepInterval = { started_at: DAY_START - 3 * HOUR, ended_at: DAY_START };
    const after: SleepInterval = { started_at: DAY_END, ended_at: DAY_END + 3 * HOUR };
    expect(sum([before, after])).toBe(0);
  });

  it('여러 수면을 합산한다', () => {
    expect(
      sum([
        { started_at: DAY_START + 1 * HOUR, ended_at: DAY_START + 2 * HOUR },
        { started_at: DAY_START - 1 * HOUR, ended_at: DAY_START + 1 * HOUR },
        { started_at: DAY_START + 9 * HOUR, ended_at: null },
      ])
    ).toBe(1 * HOUR + 1 * HOUR + 3 * HOUR);
  });

  it('기록이 없으면 0이다', () => {
    expect(sum([])).toBe(0);
  });

  // 진행 중 수면만 하나로 제한되고, 끝난 기록끼리는 시각을 수정해 겹칠 수 있다.
  // 그대로 더하면 하루에 나올 수 없는 합계가 나온다.
  describe('겹치는 기록', () => {
    it('일부만 겹치면 합집합을 센다', () => {
      // 01:00~03:00 과 02:00~04:00 은 합쳐서 01:00~04:00, 3시간이다.
      expect(
        sum([
          { started_at: DAY_START + 1 * HOUR, ended_at: DAY_START + 3 * HOUR },
          { started_at: DAY_START + 2 * HOUR, ended_at: DAY_START + 4 * HOUR },
        ])
      ).toBe(3 * HOUR);
    });

    it('한 구간이 다른 구간을 품으면 바깥 것만 센다', () => {
      expect(
        sum([
          { started_at: DAY_START + 1 * HOUR, ended_at: DAY_START + 6 * HOUR },
          { started_at: DAY_START + 2 * HOUR, ended_at: DAY_START + 3 * HOUR },
        ])
      ).toBe(5 * HOUR);
    });

    it('경계만 맞닿은 구간은 이중으로 세지 않는다', () => {
      expect(
        sum([
          { started_at: DAY_START + 1 * HOUR, ended_at: DAY_START + 2 * HOUR },
          { started_at: DAY_START + 2 * HOUR, ended_at: DAY_START + 3 * HOUR },
        ])
      ).toBe(2 * HOUR);
    });

    it('진행 중인 수면과 끝난 수면이 겹쳐도 합집합을 센다', () => {
      // 끝난 09:00~11:00 과 진행 중 10:00~(now 12:00) 은 09:00~12:00, 3시간이다.
      expect(
        sum([
          { started_at: DAY_START + 9 * HOUR, ended_at: DAY_START + 11 * HOUR },
          { started_at: DAY_START + 10 * HOUR, ended_at: null },
        ])
      ).toBe(3 * HOUR);
    });

    it('입력 순서가 섞여 있어도 같은 값이 나온다', () => {
      const sleeps: SleepInterval[] = [
        { started_at: DAY_START + 5 * HOUR, ended_at: DAY_START + 6 * HOUR },
        { started_at: DAY_START + 1 * HOUR, ended_at: DAY_START + 3 * HOUR },
        { started_at: DAY_START + 2 * HOUR, ended_at: DAY_START + 4 * HOUR },
      ];
      expect(sum(sleeps)).toBe(4 * HOUR);
      // 인자로 받은 배열을 정렬하며 건드리지 않는다.
      expect(sleeps[0].started_at).toBe(DAY_START + 5 * HOUR);
    });

    it('겹치는 기록이 아무리 많아도 하루 길이를 넘지 않는다', () => {
      const sleeps: SleepInterval[] = Array.from({ length: 10 }, () => ({
        started_at: DAY_START - 5 * HOUR,
        ended_at: DAY_END + 5 * HOUR,
      }));
      expect(sum(sleeps)).toBe(DAY_END - DAY_START);
    });
  });
});
