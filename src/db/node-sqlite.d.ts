/**
 * 테스트에서만 쓰는 Node 내장 sqlite의 최소 선언.
 *
 * `@types/node`를 넣지 않는다. tsconfig의 `types`가 `jest` 하나로 좁혀져 있는데,
 * `node`를 더하면 `process`·`Buffer` 같은 전역이 앱 코드 전체에서 보이게 된다.
 * 실기기에 없는 것이 타입으로는 있는 상태라, 잘못 쓴 코드가 컴파일에서 안 걸린다.
 *
 * 그래서 실제로 부르는 것만 적는다.
 */
declare module 'node:sqlite' {
  type RunResult = { lastInsertRowid: number | bigint; changes: number | bigint };

  type Statement = {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): RunResult;
  };

  export class DatabaseSync {
    constructor(path: string);
    prepare(sql: string): Statement;
    exec(sql: string): void;
  }
}
