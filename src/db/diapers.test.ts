import { deleteDiaper, getDiaperCount, insertDiaper } from './diapers';
import { memoryDb } from './memory-db';

const DAY = new Date(2026, 8, 18).getTime();
const NEXT = new Date(2026, 8, 19).getTime();

describe('insertDiaper / deleteDiaper', () => {
  it('INSERT는 만든 행의 id를 돌려준다', async () => {
    const db = await memoryDb();
    const first = await insertDiaper(db, { occurredAt: DAY + 1, kind: 'pee', note: null });
    const second = await insertDiaper(db, { occurredAt: DAY + 2, kind: 'poo', note: null });

    // 실행취소가 **방금 만든 행만** 지우려면 이 값이 정확해야 한다.
    expect(first).toBeGreaterThan(0);
    expect(second).not.toBe(first);
  });

  it('두 번째 DELETE는 false다', async () => {
    const db = await memoryDb();
    const id = await insertDiaper(db, { occurredAt: DAY + 1, kind: 'both', note: null });

    await expect(deleteDiaper(db, id)).resolves.toBe(true);
    // 여기서 true가 나오면 화면이 오늘 횟수를 한 번 더 내려 DB보다 작아진다.
    await expect(deleteDiaper(db, id)).resolves.toBe(false);
  });

  it('지운 행은 오늘 횟수에서 빠진다', async () => {
    const db = await memoryDb();
    const id = await insertDiaper(db, { occurredAt: DAY + 1, kind: 'pee', note: null });
    await insertDiaper(db, { occurredAt: DAY + 2, kind: 'poo', note: null });

    await expect(getDiaperCount(db, DAY, NEXT)).resolves.toBe(2);
    await deleteDiaper(db, id);
    await expect(getDiaperCount(db, DAY, NEXT)).resolves.toBe(1);
  });
});
