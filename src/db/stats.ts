import type { SQLiteDatabase } from 'expo-sqlite';

import { sleepMsByDay, type DayValue } from '@/lib/stats';
import { recentDayRanges, type DayRange } from '@/lib/time';

import { getDiaperCount } from './diapers';
import { getFeedingSummary } from './feedings';
import { listSleepsOverlapping } from './sleeps';

export type DayStats = {
  range: DayRange;
  /** 0은 진짜 0이다. 기록이 없어도 0회다. */
  feedingCount: number;
  diaperCount: number;
  /** 분유량을 한 번도 입력하지 않은 날은 `null`. `0ml`이 아니다. */
  formulaMl: DayValue;
  /** 겹치는 수면 기록이 없는 날은 `null`. `0`이 아니다. */
  sleepMs: DayValue;
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
 * `now`는 한 번만 읽어 모든 날짜에 같은 값을 넘긴다.
 */
export async function getRecentDayStats(
  db: SQLiteDatabase,
  now: Date,
  days: number
): Promise<DayStats[]> {
  const ranges = recentDayRanges(now, days);
  if (ranges.length === 0) return [];

  const sleeps = await listSleepsOverlapping(
    db,
    ranges[0].start,
    ranges[ranges.length - 1].end
  );
  const sleepMs = sleepMsByDay(sleeps, ranges, now.getTime());

  const daily = await Promise.all(
    ranges.map(async (range) => {
      const [feeding, diaperCount] = await Promise.all([
        getFeedingSummary(db, range.start, range.end),
        getDiaperCount(db, range.start, range.end),
      ]);
      return { feeding, diaperCount };
    })
  );

  return ranges.map((range, index) => ({
    range,
    feedingCount: daily[index].feeding.count,
    diaperCount: daily[index].diaperCount,
    formulaMl: daily[index].feeding.formulaMl,
    sleepMs: sleepMs[index],
  }));
}
