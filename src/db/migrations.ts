import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 4;

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

    if (current < 3) {
      // ended_at IS NULL이 "진행 중"이다. 수유량 NULL과 같은 결로,
      // "아직 안 끝남"과 "0분 잤음"은 다른 사실이다.
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS sleeps (
          id          INTEGER PRIMARY KEY NOT NULL,
          started_at  INTEGER NOT NULL,
          ended_at    INTEGER,
          note        TEXT,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL,
          CHECK (ended_at IS NULL OR ended_at > started_at)
        );
        CREATE INDEX IF NOT EXISTS idx_sleeps_started_at ON sleeps(started_at);
      `);
      // 진행 중인 수면은 하나만 허용한다.
      //
      // ON sleeps(ended_at) WHERE ended_at IS NULL 로 쓰면 안 된다. SQLite는
      // UNIQUE 인덱스에서 NULL끼리 충돌시키지 않으므로 아무것도 막지 못한다.
      // 활성 행 전부에 같은 상수를 넣어야 두 번째부터 충돌한다.
      await txn.execAsync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_sleeps_one_active
          ON sleeps((1)) WHERE ended_at IS NULL;
      `);
      current = 3;
    }

    if (current < 4) {
      // 아이는 V1에서 하나뿐이다. 키-값 테이블 대신 단일 행 테이블을 쓰면
      // 이름과 생년월일의 타입과 의미가 스키마에 그대로 드러난다.
      // CHECK로 행이 하나만 존재하도록 DB가 강제한다.
      //
      // birth_date는 epoch가 아니라 YYYY-MM-DD TEXT다. 특정 순간이 아니라
      // 달력 날짜라, epoch로 두면 시간대가 바뀔 때 날짜가 밀린다.
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS baby (
          id         INTEGER PRIMARY KEY CHECK (id = 1),
          name       TEXT,
          birth_date TEXT,
          updated_at INTEGER NOT NULL
        );
      `);
      current = 4;
    }

    // PRAGMA는 바인딩 파라미터를 받지 않는다. 값은 이 파일의 상수다.
    await txn.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
}
