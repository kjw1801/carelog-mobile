import type { SQLiteDatabase } from 'expo-sqlite';

export type Feeding = {
  id: number;
  occurred_at: number;
  /** 입력하지 않았으면 null. `0ml`과 다른 사실이다. */
  amount_ml: number | null;
  note: string | null;
};

export type FeedingInput = {
  occurredAt: number;
  amountMl: number | null;
  note: string | null;
};

export type TodaySummary = {
  count: number;
  /** 오늘 수유량을 한 번도 입력하지 않았으면 null. 0이 아니다. */
  amountMl: number | null;
};

const COLUMNS = 'id, occurred_at, amount_ml, note';

export function listFeedings(db: SQLiteDatabase): Promise<Feeding[]> {
  return db.getAllAsync<Feeding>(
    `SELECT ${COLUMNS} FROM feedings ORDER BY occurred_at DESC`
  );
}

export function getFeeding(db: SQLiteDatabase, id: number): Promise<Feeding | null> {
  return db.getFirstAsync<Feeding>(`SELECT ${COLUMNS} FROM feedings WHERE id = ?`, id);
}

export function getLastFeeding(db: SQLiteDatabase): Promise<Feeding | null> {
  return db.getFirstAsync<Feeding>(
    `SELECT ${COLUMNS} FROM feedings ORDER BY occurred_at DESC LIMIT 1`
  );
}

/**
 * 날짜 경계는 JS에서 계산해 숫자 범위로 조회한다. SQLite의 unixepoch 계열은
 * 초 단위라 밀리초를 그대로 넘길 수 없다.
 *
 * SUM은 대상이 전부 NULL이면 NULL을 돌려준다. 여기서는 그게 정확히 원하는
 * 값이다 — 아무도 양을 입력하지 않은 날은 0ml이 아니라 "기록 없음"이다.
 */
export async function getTodaySummary(
  db: SQLiteDatabase,
  start: number,
  end: number
): Promise<TodaySummary> {
  const row = await db.getFirstAsync<{ count: number; amount_ml: number | null }>(
    `SELECT COUNT(*) AS count, SUM(amount_ml) AS amount_ml
       FROM feedings
      WHERE occurred_at >= ? AND occurred_at < ?`,
    start,
    end
  );
  return { count: row?.count ?? 0, amountMl: row?.amount_ml ?? null };
}

export async function insertFeeding(db: SQLiteDatabase, input: FeedingInput): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO feedings (occurred_at, amount_ml, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    input.occurredAt,
    input.amountMl,
    input.note,
    now,
    now
  );
}

export async function updateFeeding(
  db: SQLiteDatabase,
  id: number,
  input: FeedingInput
): Promise<void> {
  await db.runAsync(
    `UPDATE feedings
        SET occurred_at = ?, amount_ml = ?, note = ?, updated_at = ?
      WHERE id = ?`,
    input.occurredAt,
    input.amountMl,
    input.note,
    Date.now(),
    id
  );
}

export async function deleteFeeding(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM feedings WHERE id = ?', id);
}
