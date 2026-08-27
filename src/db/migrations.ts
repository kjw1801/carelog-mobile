import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= DATABASE_VERSION) return;

  // journal_mode는 트랜잭션 안에서 바꿀 수 없다 ("cannot change into wal
  // mode from within a transaction"). 트랜잭션을 열기 전에 설정한다.
  await db.execAsync("PRAGMA journal_mode = 'wal'");

  // 스키마와 버전을 한 트랜잭션으로 묶는다. 중간에 실패했는데 user_version만
  // 올라가면 다음 실행에서 테이블 없이 마이그레이션을 건너뛴다.
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`
      CREATE TABLE IF NOT EXISTS feedings (
        id          INTEGER PRIMARY KEY NOT NULL,
        occurred_at INTEGER NOT NULL,
        amount_ml   INTEGER CHECK (amount_ml IS NULL OR amount_ml > 0),
        note        TEXT,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_feedings_occurred_at ON feedings(occurred_at);
    `);
    // PRAGMA는 바인딩 파라미터를 받지 않는다. 값은 이 파일의 상수다.
    await txn.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
}
