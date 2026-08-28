import type { SQLiteDatabase } from 'expo-sqlite';

import type { DiaperKind } from './diapers';
import type { BreastSide, StoredFeedingKind } from './feedings';

/**
 * Records 화면의 통합 타임라인 한 줄.
 *
 * 각각 조회해 JS에서 합치지 않고 UNION ALL로 한 번에 읽는다. 정렬을 SQLite에
 * 맡기면 세 테이블의 인덱스를 그대로 쓸 수 있다.
 *
 * 수면은 구간이라 시각이 둘인데, 타임라인에서는 시작 시각으로 줄을 세운다.
 */
export type TimelineEntry = {
  type: 'feeding' | 'diaper' | 'sleep';
  id: number;
  /** 수면일 때는 started_at. */
  occurred_at: number;
  /** 수유일 때만. 입력하지 않았으면 null. */
  amount_ml: number | null;
  /** 수유일 때만. v4까지의 기록은 `unspecified`다. */
  feeding_kind: StoredFeedingKind | null;
  /** 수유가 모유일 때만. */
  feeding_side: BreastSide | null;
  /** 기저귀일 때만. */
  diaper_kind: DiaperKind | null;
  /** 수면일 때만 의미가 있다. null이면 진행 중. */
  sleep_ended_at: number | null;
  note: string | null;
};

export function listTimeline(db: SQLiteDatabase): Promise<TimelineEntry[]> {
  return db.getAllAsync<TimelineEntry>(
    `SELECT 'feeding' AS type, id, occurred_at, amount_ml,
            kind AS feeding_kind, side AS feeding_side,
            NULL AS diaper_kind, NULL AS sleep_ended_at, note
       FROM feedings
      UNION ALL
     SELECT 'diaper', id, occurred_at, NULL, NULL, NULL, kind, NULL, note
       FROM diapers
      UNION ALL
     SELECT 'sleep', id, started_at, NULL, NULL, NULL, NULL, ended_at, note
       FROM sleeps
      ORDER BY occurred_at DESC`
  );
}
