import type { SQLiteDatabase } from 'expo-sqlite';

export type Baby = {
  name: string | null;
  /** 달력 날짜 `YYYY-MM-DD`. epoch가 아니다. */
  birth_date: string | null;
};

/** 아이는 V1에서 하나뿐이다. 없으면 null. */
export function getBaby(db: SQLiteDatabase): Promise<Baby | null> {
  return db.getFirstAsync<Baby>('SELECT name, birth_date FROM baby WHERE id = 1');
}

/**
 * 단일 행을 넣거나 갱신한다. `id = 1`이 고정이라 UPSERT 하나로 끝난다.
 */
export async function saveBaby(db: SQLiteDatabase, baby: Baby): Promise<void> {
  await db.runAsync(
    `INSERT INTO baby (id, name, birth_date, updated_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE
        SET name = excluded.name,
            birth_date = excluded.birth_date,
            updated_at = excluded.updated_at`,
    baby.name,
    baby.birth_date,
    Date.now()
  );
}
