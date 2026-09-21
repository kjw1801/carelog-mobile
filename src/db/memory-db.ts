import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDbIfNeeded } from './migrations';

/**
 * **테스트 전용이다.** 앱 코드에서 부르면 기기에서 터진다 — `node:sqlite`는
 * Node 내장 모듈이라 React Native 번들에 없다. jest의 `testMatch`가
 * `*.test.ts`만 모으므로 이 파일 자체는 테스트로 실행되지 않는다.
 *
 * 집계 SQL을 **실제로 실행**하려고 둔다. 가짜 DB에 행을 돌려주게 하면 별칭을
 * 한쪽만 바꿔도 통과해서, 검사하려는 연결 자체가 검사되지 않는다.
 *
 * 스키마는 마이그레이션을 그대로 돌려서 만든다. `CREATE TABLE`을 베껴 두면
 * 실제 스키마가 바뀔 때 테스트만 옛 모양으로 남는다.
 */
export async function memoryDb(): Promise<SQLiteDatabase> {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    getFirstAsync: async (sql: string, ...args: unknown[]) =>
      (sqlite.prepare(sql).get(...(args as never[])) ?? null) as never,
    getAllAsync: async (sql: string, ...args: unknown[]) =>
      sqlite.prepare(sql).all(...(args as never[])) as never,
    runAsync: async (sql: string, ...args: unknown[]) => {
      const result = sqlite.prepare(sql).run(...(args as never[]));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    execAsync: async (sql: string) => {
      sqlite.exec(sql);
    },
    withExclusiveTransactionAsync: async (task: (txn: SQLiteDatabase) => Promise<void>) => {
      await task(db);
    },
  } as unknown as SQLiteDatabase;

  await migrateDbIfNeeded(db);
  return db;
}
