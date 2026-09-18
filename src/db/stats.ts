import type { SQLiteDatabase } from 'expo-sqlite';

import { type DayValue } from '@/lib/stats';
import { recentDayRanges, type DayRange } from '@/lib/time';

import { getDiaperCount } from './diapers';
import { getFeedingSummary } from './feedings';
import { listSleepsOverlapping, type Sleep } from './sleeps';

export type DayStats = {
  range: DayRange;
  /** 0은 진짜 0이다. 기록이 없어도 0회다. */
  feedingCount: number;
  diaperCount: number;
  /** 분유량을 한 번도 입력하지 않은 날은 `null`. `0ml`이 아니다. */
  formulaMl: DayValue;
};

export type RecentStats = {
  days: DayStats[];
  /**
   * 범위와 겹치는 수면 기록 원본.
   *
   * **여기서 합계를 접지 않는다.** 진행 중인 수면은 시간이 흐르면 길어지는데,
   * 조회 시점에 숫자로 접으면 화면을 열어둔 동안 오늘 막대가 얼어붙는다.
   * 화면이 `sleepMsByDay`로 현재 시각에 맞춰 다시 센다.
   */
  sleeps: Sleep[];
};

/**
 * 최근 며칠의 날짜별 집계.
 *
 * **수면만 한 번에 조회한다.** 구간이라 날짜별로 따로 물으면 같은 기록을 여러 번
 * 받고, 자르는 일은 어차피 JS에서 해야 한다. 나머지 둘은 날짜별 집계라 SQL이
 * 세는 편이 낫다 — 7일이면 조회 15회고 로컬 SQLite에서는 작다.
 *
 * SQL로 날짜를 그룹화하지 않는다. `unixepoch` 계열은 초 단위인데 이 앱은 밀리초를
 * 쓰고, 현지 시간대와 서머타임까지 SQL에서 맞춰야 한다. 경계는 JS가 만든다.
 *
 */
export async function getRecentDayStats(
  db: SQLiteDatabase,
  now: Date,
  days: number
): Promise<RecentStats> {
  const ranges = recentDayRanges(now, days);
  if (ranges.length === 0) return { days: [], sleeps: [] };

  const sleeps = await listSleepsOverlapping(
    db,
    ranges[0].start,
    ranges[ranges.length - 1].end
  );

  const daily = await Promise.all(
    ranges.map(async (range) => {
      const [feeding, diaperCount] = await Promise.all([
        getFeedingSummary(db, range.start, range.end),
        getDiaperCount(db, range.start, range.end),
      ]);
      return { feeding, diaperCount };
    })
  );

  return {
    days: ranges.map((range, index) => ({
      range,
      feedingCount: daily[index].feeding.count,
      diaperCount: daily[index].diaperCount,
      formulaMl: daily[index].feeding.formulaMl,
    })),
    sleeps,
  };
}
