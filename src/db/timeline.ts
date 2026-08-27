import type { SQLiteDatabase } from 'expo-sqlite';

import type { DiaperKind } from './diapers';

/**
 * Records 화면의 통합 타임라인 한 줄.
 *
 * 수유와 기저귀를 각각 조회해 JS에서 합치지 않고 UNION ALL로 한 번에 읽는다.
 * 정렬을 SQLite에 맡기면 양쪽 occurred_at 인덱스를 그대로 쓸 수 있다.
 */
export type TimelineEntry = {
  type: 'feeding' | 'diaper';
  id: number;
  occurred_at: number;
  /** 수유일 때만. 입력하지 않았으면 null. */
  amount_ml: number | null;
  /** 기저귀일 때만. */
  diaper_kind: DiaperKind | null;
  note: string | null;
};

export function listTimeline(db: SQLiteDatabase): Promise<TimelineEntry[]> {
  return db.getAllAsync<TimelineEntry>(
    `SELECT 'feeding' AS type, id, occurred_at, amount_ml, NULL AS diaper_kind, note
       FROM feedings
      UNION ALL
     SELECT 'diaper' AS type, id, occurred_at, NULL AS amount_ml, kind AS diaper_kind, note
       FROM diapers
      ORDER BY occurred_at DESC`
  );
}
