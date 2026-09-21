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

/**
 * 오늘 화면의 원터치 버튼 라벨. 셋이 한 줄에 들어가야 해서 `소변+대변`을 줄인다.
 * 기록 목록은 `DIAPER_KIND_LABEL`을 그대로 쓴다 — 훑어볼 때는 정확한 쪽이 낫다.
 * 낭독은 `소변과 대변 모두`로 온전히 준다.
 */
export const DIAPER_QUICK_LABEL: Record<DiaperKind, string> = {
  pee: '소변',
  poo: '대변',
  both: '둘 다',
};

export const DIAPER_SPOKEN_LABEL: Record<DiaperKind, string> = {
  pee: '소변',
  poo: '대변',
  both: '소변과 대변 모두',
};

export const DIAPER_KINDS: DiaperKind[] = ['pee', 'poo', 'both'];

const COLUMNS = 'id, occurred_at, kind, note';

export function getDiaper(db: SQLiteDatabase, id: number): Promise<Diaper | null> {
  return db.getFirstAsync<Diaper>(`SELECT ${COLUMNS} FROM diapers WHERE id = ?`, id);
}

/** 날짜 경계는 JS에서 계산해 숫자 범위로 조회한다. */
export async function getDiaperCount(
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

/** 원터치 저장의 실행취소가 **방금 만든 행만** 지울 수 있도록 id를 돌려준다. */
export async function insertDiaper(db: SQLiteDatabase, input: DiaperInput): Promise<number> {
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO diapers (occurred_at, kind, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    input.occurredAt,
    input.kind,
    input.note,
    now,
    now
  );
  return result.lastInsertRowId;
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

/**
 * 지웠으면 `true`. 이미 없는 id면 `false`다 — `endSleep`과 같은 모양이다.
 *
 * 실행취소가 화면의 횟수를 내리기 전에 이걸 본다. 무조건 내리면 두 번 지워진
 * 기록에서 화면과 DB가 어긋난다.
 */
export async function deleteDiaper(db: SQLiteDatabase, id: number): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM diapers WHERE id = ?', id);
  return result.changes > 0;
}
