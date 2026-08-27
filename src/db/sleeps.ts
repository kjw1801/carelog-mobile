import type { SQLiteDatabase } from 'expo-sqlite';

export type Sleep = {
  id: number;
  started_at: number;
  /** 진행 중이면 null. */
  ended_at: number | null;
  note: string | null;
};

export type SleepInput = {
  startedAt: number;
  /** null이면 진행 중. */
  endedAt: number | null;
  note: string | null;
};

const COLUMNS = 'id, started_at, ended_at, note';

export function getSleep(db: SQLiteDatabase, id: number): Promise<Sleep | null> {
  return db.getFirstAsync<Sleep>(`SELECT ${COLUMNS} FROM sleeps WHERE id = ?`, id);
}

/** 진행 중인 수면. DB 유니크 인덱스가 최대 하나임을 보장한다. */
export function getActiveSleep(db: SQLiteDatabase): Promise<Sleep | null> {
  return db.getFirstAsync<Sleep>(
    `SELECT ${COLUMNS} FROM sleeps WHERE ended_at IS NULL`
  );
}

/**
 * 주어진 구간과 겹치는 수면. 전체를 다 읽지 않고 경계로 걸러낸다.
 *
 * 진행 중인 수면(`ended_at IS NULL`)은 아직 끝나지 않았으므로, 시작이 구간 끝보다
 * 앞이기만 하면 겹친다. 따라서 지금 진행 중인 수면은 항상 오늘 결과에 들어온다.
 */
export function listSleepsOverlapping(
  db: SQLiteDatabase,
  rangeStart: number,
  rangeEnd: number
): Promise<Sleep[]> {
  return db.getAllAsync<Sleep>(
    `SELECT ${COLUMNS} FROM sleeps
      WHERE started_at < ?
        AND (ended_at IS NULL OR ended_at > ?)
      ORDER BY started_at`,
    rangeEnd,
    rangeStart
  );
}

export async function startSleep(db: SQLiteDatabase, startedAt: number): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO sleeps (started_at, ended_at, note, created_at, updated_at)
     VALUES (?, NULL, NULL, ?, ?)`,
    startedAt,
    now,
    now
  );
}

/**
 * 진행 중인 수면만 종료한다. 이미 종료된 행은 건드리지 않는다 —
 * 낡은 상태로 두 번 호출하면 확정된 종료 시각이 조용히 덮어써진다.
 *
 * @returns 실제로 종료했으면 true, 이미 끝났거나 없으면 false.
 */
export async function endSleep(
  db: SQLiteDatabase,
  id: number,
  endedAt: number
): Promise<boolean> {
  const result = await db.runAsync(
    'UPDATE sleeps SET ended_at = ?, updated_at = ? WHERE id = ? AND ended_at IS NULL',
    endedAt,
    Date.now(),
    id
  );
  return result.changes > 0;
}

export async function updateSleep(
  db: SQLiteDatabase,
  id: number,
  input: SleepInput
): Promise<void> {
  await db.runAsync(
    `UPDATE sleeps
        SET started_at = ?, ended_at = ?, note = ?, updated_at = ?
      WHERE id = ?`,
    input.startedAt,
    input.endedAt,
    input.note,
    Date.now(),
    id
  );
}

export async function deleteSleep(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM sleeps WHERE id = ?', id);
}
