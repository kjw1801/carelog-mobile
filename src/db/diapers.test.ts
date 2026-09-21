import { deleteDiaper, getDiaperCount, insertDiaper } from './diapers';
import { memoryDb } from './memory-db';
import { listTimeline } from './timeline';

/** 화면이 삭제할 행의 id를 얻는 경로 그대로 읽는다. */
async function lastDiaperId(db: Awaited<ReturnType<typeof memoryDb>>): Promise<number> {
  const rows = await listTimeline(db);
  const row = rows.find((entry) => entry.type === 'diaper');
  if (!row) throw new Error('기저귀 기록이 없다');
  return row.id;
}

const DAY = new Date(2026, 8, 18).getTime();
const NEXT = new Date(2026, 8, 19).getTime();

describe('insertDiaper / deleteDiaper', () => {
  it('두 번째 DELETE는 false다', async () => {
    const db = await memoryDb();
    await insertDiaper(db, { occurredAt: DAY + 1, kind: 'both', note: null });
    const id = await lastDiaperId(db);

    await expect(deleteDiaper(db, id)).resolves.toBe(true);
    // 여기서 true가 나오면 지운 것이 없는데도 `삭제했습니다`가 뜬다.
    await expect(deleteDiaper(db, id)).resolves.toBe(false);
  });

  it('지운 행은 오늘 횟수에서 빠진다', async () => {
    const db = await memoryDb();
    await insertDiaper(db, { occurredAt: DAY + 1, kind: 'pee', note: null });
    await insertDiaper(db, { occurredAt: DAY + 2, kind: 'poo', note: null });

    await expect(getDiaperCount(db, DAY, NEXT)).resolves.toBe(2);
    await deleteDiaper(db, await lastDiaperId(db));
    await expect(getDiaperCount(db, DAY, NEXT)).resolves.toBe(1);
  });
});
