import type { SQLiteDatabase } from 'expo-sqlite';

/** 모유를 먹인 위치. 모유일 때만 값이 있다. */
export type BreastSide = 'left' | 'right' | 'both';

/** 새로 만들 수 있는 수유 종류. `unspecified`는 여기 없다. */
export type NewFeedingKind = 'breast' | 'formula';

/**
 * DB에 저장돼 있을 수 있는 종류.
 *
 * `unspecified`는 v4까지의 기록에만 붙는다. 그때는 종류를 물어보지 않았으므로
 * 모유였는지 분유였는지 알 수 없고, 추정하지 않는다.
 */
export type StoredFeedingKind = NewFeedingKind | 'unspecified';

export type Feeding = {
  id: number;
  occurred_at: number;
  kind: StoredFeedingKind;
  /** 모유일 때만 값이 있다. */
  side: BreastSide | null;
  /** 분유일 때만 값이 있을 수 있다. 입력하지 않았으면 null — `0ml`과 다르다. */
  amount_ml: number | null;
  note: string | null;
};

type FeedingBaseInput = {
  occurredAt: number;
  note: string | null;
};

/**
 * 새 수유 기록의 입력.
 *
 * 판별 유니온이라 `unspecified`뿐 아니라 모유 + 수유량, 분유 + 위치 같은
 * 조합도 컴파일 단계에서 막힌다. DB의 CHECK는 마지막 안전장치로 남는다.
 */
export type NewFeedingInput = FeedingBaseInput &
  (
    | { kind: 'breast'; side: BreastSide; amountMl: null }
    | { kind: 'formula'; side: null; amountMl: number | null }
  );

/**
 * 기존 기록을 수정할 때의 입력. 종류를 고치지 않고 저장하면 `unspecified`가
 * 그대로 유지된다. 이 타입은 수정 경로에서만 쓴다.
 */
export type StoredFeedingInput =
  | NewFeedingInput
  | (FeedingBaseInput & { kind: 'unspecified'; side: null; amountMl: number | null });

export type TodaySummary = {
  count: number;
  /** 오늘 분유량을 한 번도 입력하지 않았으면 null. 0이 아니다. */
  formulaMl: number | null;
};

const COLUMNS = 'id, occurred_at, kind, side, amount_ml, note';

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
 * 양은 **분유만** 더한다. 모유는 양이 없고, `unspecified`는 그 양이 분유였는지
 * 알 수 없으므로 뺀다. 종류를 물어보기 전에 적힌 숫자를 분유량이라고 부르면
 * 그게 곧 추정이다.
 *
 * SUM은 대상이 전부 NULL이면 NULL을 돌려준다. 여기서는 그게 정확히 원하는
 * 값이다 — 아무도 분유량을 입력하지 않은 날은 0ml이 아니라 "기록 없음"이다.
 */
export async function getTodaySummary(
  db: SQLiteDatabase,
  start: number,
  end: number
): Promise<TodaySummary> {
  const row = await db.getFirstAsync<{ count: number; formula_ml: number | null }>(
    `SELECT COUNT(*) AS count,
            SUM(CASE WHEN kind = 'formula' THEN amount_ml END) AS formula_ml
       FROM feedings
      WHERE occurred_at >= ? AND occurred_at < ?`,
    start,
    end
  );
  return { count: row?.count ?? 0, formulaMl: row?.formula_ml ?? null };
}

/**
 * 새 기록은 `NewFeedingInput`만 받는다. `unspecified`를 새로 만들 수 없어야
 * 마이그레이션 전용 상태가 다시 생겨나지 않는데, DB는 기존 행 때문에 그 값을
 * 허용해야 해서 INSERT를 구분하지 못한다. 그래서 타입이 막는다.
 */
export async function insertFeeding(
  db: SQLiteDatabase,
  input: NewFeedingInput
): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO feedings (occurred_at, kind, side, amount_ml, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.occurredAt,
    input.kind,
    input.side,
    input.amountMl,
    input.note,
    now,
    now
  );
}

/** 수정만 `unspecified` 유지를 허용한다. */
export async function updateFeeding(
  db: SQLiteDatabase,
  id: number,
  input: StoredFeedingInput
): Promise<void> {
  await db.runAsync(
    `UPDATE feedings
        SET occurred_at = ?, kind = ?, side = ?, amount_ml = ?, note = ?, updated_at = ?
      WHERE id = ?`,
    input.occurredAt,
    input.kind,
    input.side,
    input.amountMl,
    input.note,
    Date.now(),
    id
  );
}

export async function deleteFeeding(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM feedings WHERE id = ?', id);
}

export const BREAST_SIDE_LABEL: Record<BreastSide, string> = {
  left: '왼쪽',
  right: '오른쪽',
  both: '양쪽',
};

export const FEEDING_KIND_LABEL: Record<NewFeedingKind, string> = {
  breast: '모유',
  formula: '분유',
};
