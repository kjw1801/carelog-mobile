import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 5;

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

    if (current < 5) {
      // 수유를 모유와 분유로 나눈다. 모유는 양이 없고 위치가 있고, 분유는
      // 위치가 없고 양이 선택이다. 서로의 열이 비어 있어야 한다는 규칙을
      // 앱에서만 지키면 언젠가 어긋나므로 CHECK로 못 박는다.
      //
      // v4까지의 기록은 종류를 알 수 없다. 양이 없으면 모유였을 수도, 양을
      // 적지 않은 분유였을 수도 있고, 양이 있어도 유축한 모유였을 수 있다.
      // 추정하지 않고 'unspecified'로 보존한다. 새 기록은 이 값으로 저장하지
      // 않으며, 그 금지는 DB가 아니라 insertFeeding의 타입이 맡는다 —
      // DB는 기존 행 때문에 이 값을 허용해야 해서 구분할 수 없다.
      //
      // SQLite는 열 추가로 이런 교차 CHECK를 붙일 수 없어 테이블을 다시
      // 만든다. 인덱스는 테이블과 함께 사라지므로 마지막에 다시 만든다.
      //
      // amount_ml에 typeof 검사를 더한다. INTEGER 선언만으로는 1.5가 통과한다.
      await txn.execAsync(`
        CREATE TABLE feedings_v5 (
          id          INTEGER PRIMARY KEY NOT NULL,
          occurred_at INTEGER NOT NULL,
          kind        TEXT NOT NULL
                      CHECK (kind IN ('breast', 'formula', 'unspecified')),
          side        TEXT CHECK (side IS NULL OR side IN ('left', 'right', 'both')),
          amount_ml   INTEGER CHECK (
                        amount_ml IS NULL OR
                        (typeof(amount_ml) = 'integer' AND amount_ml > 0)
                      ),
          note        TEXT,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL,
          CHECK (
            (kind = 'breast' AND side IS NOT NULL AND amount_ml IS NULL) OR
            (kind = 'formula' AND side IS NULL) OR
            (kind = 'unspecified' AND side IS NULL)
          )
        );

        INSERT INTO feedings_v5
          (id, occurred_at, kind, side, amount_ml, note, created_at, updated_at)
          SELECT id, occurred_at, 'unspecified', NULL, amount_ml, note,
                 created_at, updated_at
            FROM feedings;

        DROP TABLE feedings;
        ALTER TABLE feedings_v5 RENAME TO feedings;

        CREATE INDEX idx_feedings_occurred_at ON feedings(occurred_at);
      `);
      current = 5;
    }

    // PRAGMA는 바인딩 파라미터를 받지 않는다. 값은 이 파일의 상수다.
    await txn.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
}
