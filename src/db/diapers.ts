import type { SQLiteDatabase } from 'expo-sqlite';

export type DiaperKind = 'pee' | 'poo' | 'both';

export type Diaper = {
  id: number;
  occurred_at: number;
  kind: DiaperKind;
  note: string | null;
};

export type DiaperInput = {
  occurredAt: number;
  kind: DiaperKind;
  note: string | null;
};

export const DIAPER_KIND_LABEL: Record<DiaperKind, string> = {
  pee: '소변',
  poo: '대변',
  both: '소변+대변',
};

const COLUMNS = 'id, occurred_at, kind, note';

export function getDiaper(db: SQLiteDatabase, id: number): Promise<Diaper | null> {
  return db.getFirstAsync<Diaper>(`SELECT ${COLUMNS} FROM diapers WHERE id = ?`, id);
}

/** 날짜 경계는 JS에서 계산해 숫자 범위로 조회한다. */
export async function getTodayDiaperCount(
  db: SQLiteDatabase,
  start: number,
  end: number
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM diapers
      WHERE occurred_at >= ? AND occurred_at < ?`,
    start,
    end
  );
  return row?.count ?? 0;
}

export async function insertDiaper(db: SQLiteDatabase, input: DiaperInput): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO diapers (occurred_at, kind, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    input.occurredAt,
    input.kind,
    input.note,
    now,
    now
  );
}

export async function updateDiaper(
  db: SQLiteDatabase,
  id: number,
  input: DiaperInput
): Promise<void> {
  await db.runAsync(
    `UPDATE diapers
        SET occurred_at = ?, kind = ?, note = ?, updated_at = ?
      WHERE id = ?`,
    input.occurredAt,
    input.kind,
    input.note,
    Date.now(),
    id
  );
}

export async function deleteDiaper(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM diapers WHERE id = ?', id);
}
