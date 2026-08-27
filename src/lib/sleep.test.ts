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
});
