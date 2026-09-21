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

/**
 * 화면·낭독·Toast가 **한 벌을 같이 쓴다.** 예전에는 버튼용·목록용·낭독용을
 * 따로 뒀는데, 그 갈라짐이 `소변과 대변 모두` + `으로` = "모두으로"를 만들었다.
 *
 * 그래서 두 가지를 지킨다.
 * - 셋 다 **받침으로 끝난다** — `${DIAPER_KIND_LABEL[kind]}으로`처럼 조사를 붙인다.
 * - 셋 다 **소리로만 들어도 뜻이 통한다** — `둘 다`는 무엇이 둘인지 알 수 없어 쓰지 않는다.
 *
 * `대소변`은 3글자라 원터치 버튼 한 줄에 들어가고, `+` 기호와 달리 낭독기가
 * "더하기"로 읽지도 않는다.
 */
export const DIAPER_KIND_LABEL: Record<DiaperKind, string> = {
  pee: '소변',
  poo: '대변',
  both: '대소변',
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

/**
 * 지웠으면 `true`. 이미 없는 id면 `false`다 — `deleteFeeding`·`endSleep`과 같다.
 *
 * **폼의 성공 Toast가 이 값을 본다.** 목록이 낡아 이미 지워진 행을 다시 지우면
 * 아무 일도 없었으므로 `기저귀 기록을 삭제했습니다`는 거짓말이 된다.
 */
export async function deleteDiaper(db: SQLiteDatabase, id: number): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM diapers WHERE id = ?', id);
  return result.changes > 0;
}
