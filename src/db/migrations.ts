import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 2;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;
  if (current >= DATABASE_VERSION) return;

  // journal_mode는 트랜잭션 안에서 바꿀 수 없다 ("cannot change into wal
  // mode from within a transaction"). 트랜잭션을 열기 전에 설정한다.
  await db.execAsync("PRAGMA journal_mode = 'wal'");

  // 스키마와 버전을 한 트랜잭션으로 묶는다. 중간에 실패했는데 user_version만
  // 올라가면 다음 실행에서 테이블 없이 마이그레이션을 건너뛴다.
  await db.withExclusiveTransactionAsync(async (txn) => {
    if (current < 1) {
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
      current = 1;
    }

    if (current < 2) {
      // 기저귀는 양이 없고 종류가 필수다. 종류를 자유 문자열로 두면 오타가
      // 그대로 저장되므로 CHECK로 세 값만 허용한다.
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS diapers (
          id          INTEGER PRIMARY KEY NOT NULL,
          occurred_at INTEGER NOT NULL,
          kind        TEXT NOT NULL CHECK (kind IN ('pee', 'poo', 'both')),
          note        TEXT,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_diapers_occurred_at ON diapers(occurred_at);
      `);
      current = 2;
    }

    // PRAGMA는 바인딩 파라미터를 받지 않는다. 값은 이 파일의 상수다.
    await txn.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
}
