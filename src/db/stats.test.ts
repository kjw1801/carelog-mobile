import type { SQLiteDatabase } from 'expo-sqlite';

import { recentDayRanges } from '@/lib/time';

import { getRecentDayStats } from './stats';
import type { Sleep } from './sleeps';

/**
 * 조회 자체는 각 모듈이 이미 책임진다. 여기서 볼 것은 **조정**이다 — 수면을 한 번만
 * 묻는지, 전체 범위를 넘기는지, 날짜별 값이 어긋나지 않는지.
 *
 * 그래서 DB를 흉내 내되 SQL은 해석하지 않고 어떤 인자로 불렸는지만 기록한다.
 */
function fakeDb(options: {
  sleeps?: Sleep[];
  feedings?: Record<number, { count: number; formula_ml: number | null }>;
  diapers?: Record<number, number>;
}) {
  const calls = {
    sleep: [] as number[][],
    feeding: [] as number[][],
    diaper: [] as number[][],
  };

  const db = {
    getAllAsync: async (_sql: string, ...args: number[]) => {
      calls.sleep.push(args);
      return options.sleeps ?? [];
    },
    // 인자를 전부 기록한다. 시작만 보면 끝 경계가 틀려도 통과한다.
    getFirstAsync: async (sql: string, ...args: number[]) => {
      const [start] = args;
      if (sql.includes('FROM feedings')) {
        calls.feeding.push(args);
        return options.feedings?.[start] ?? { count: 0, formula_ml: null };
      }
      calls.diaper.push(args);
      return { count: options.diapers?.[start] ?? 0 };
    },
  } as unknown as SQLiteDatabase;

  return { db, calls };
}

const NOW = new Date(2026, 8, 18, 10);
const HOUR = 3_600_000;

describe('getRecentDayStats', () => {
  it('요청한 날짜 수만큼 과거부터 오늘 순으로 돌려준다', async () => {
    const { db } = fakeDb({});
    const stats = await getRecentDayStats(db, NOW, 7);
    expect(stats.map((s) => s.range)).toEqual(recentDayRanges(NOW, 7));
  });

  it('날짜별 조회에 그 날의 시작과 끝을 그대로 넘긴다', async () => {
    // 끝 경계가 틀리면 옆날 기록이 섞이거나 빠진다.
    const { db, calls } = fakeDb({});
    await getRecentDayStats(db, NOW, 7);
    const expected = recentDayRanges(NOW, 7).map((r) => [r.start, r.end]);
    expect(calls.feeding).toEqual(expected);
    expect(calls.diaper).toEqual(expected);
  });

  it('수면은 한 번만, 전체 범위로 조회한다', async () => {
    // 날짜별로 물으면 같은 기록을 여러 번 받는다. 자르는 일은 어차피 JS가 한다.
    const { db, calls } = fakeDb({});
    await getRecentDayStats(db, NOW, 7);
    const ranges = recentDayRanges(NOW, 7);
    expect(calls.sleep).toHaveLength(1);
    // `listSleepsOverlapping`은 end를 먼저 바인딩한다. 인자 순서가 바뀌면 여기서 걸린다.
    expect(calls.sleep[0]).toEqual([ranges[ranges.length - 1].end, ranges[0].start]);
  });

  it('날짜별 값이 서로 어긋나지 않는다', async () => {
    const ranges = recentDayRanges(NOW, 3);
    const { db } = fakeDb({
      feedings: {
        [ranges[0].start]: { count: 1, formula_ml: 100 },
        [ranges[1].start]: { count: 2, formula_ml: null },
        [ranges[2].start]: { count: 3, formula_ml: 300 },
      },
      diapers: { [ranges[0].start]: 4, [ranges[1].start]: 5, [ranges[2].start]: 6 },
    });
    const stats = await getRecentDayStats(db, NOW, 3);
    expect(stats.map((s) => s.feedingCount)).toEqual([1, 2, 3]);
    expect(stats.map((s) => s.diaperCount)).toEqual([4, 5, 6]);
    expect(stats.map((s) => s.formulaMl)).toEqual([100, null, 300]);
  });

  it('진행 중인 수면에 모든 날짜가 같은 now를 쓴다', async () => {
    const ranges = recentDayRanges(NOW, 2);
    const { db } = fakeDb({
      sleeps: [{ id: 1, started_at: ranges[1].start - HOUR, ended_at: null } as Sleep],
    });
    const stats = await getRecentDayStats(db, NOW, 2);
    // 어제 1시간, 오늘은 자정부터 10시까지.
    expect(stats.map((s) => s.sleepMs)).toEqual([HOUR, 10 * HOUR]);
  });

  it('기록이 없는 날은 횟수 0과 기록 없음을 구분한다', async () => {
    const { db } = fakeDb({});
    const [day] = await getRecentDayStats(db, NOW, 1);
    expect(day.feedingCount).toBe(0);
    expect(day.diaperCount).toBe(0);
    expect(day.formulaMl).toBeNull();
    expect(day.sleepMs).toBeNull();
  });

  it('0일을 요청하면 조회하지 않는다', async () => {
    const { db, calls } = fakeDb({});
    expect(await getRecentDayStats(db, NOW, 0)).toEqual([]);
    expect(calls.sleep).toHaveLength(0);
    expect(calls.feeding).toHaveLength(0);
    expect(calls.diaper).toHaveLength(0);
  });
});
