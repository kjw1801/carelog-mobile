import { memoryDb } from './memory-db';
import { deleteSleep, getActiveSleep, listSleepsOverlapping, startSleep } from './sleeps';

const DAY = new Date(2026, 8, 18).getTime();
const NEXT = new Date(2026, 8, 19).getTime();

describe('deleteSleep', () => {
  it('두 번째 DELETE는 false다', async () => {
    const db = await memoryDb();
    await startSleep(db, DAY + 1);
    // 화면이 삭제할 행의 id를 얻는 경로 그대로 읽는다.
    const id = (await getActiveSleep(db))?.id ?? 0;

    await expect(deleteSleep(db, id)).resolves.toBe(true);
    // 여기서 true가 나오면 지운 것이 없는데도 `삭제했습니다`가 뜬다.
    // 목록이 낡아 같은 기록을 두 번 지울 때 이 자리로 온다.
    await expect(deleteSleep(db, id)).resolves.toBe(false);
  });

  it('없는 id는 false다', async () => {
    const db = await memoryDb();
    await expect(deleteSleep(db, 9999)).resolves.toBe(false);
  });

  it('지운 행은 겹치는 수면 목록에서 빠진다', async () => {
    const db = await memoryDb();
    await startSleep(db, DAY + 1);
    const id = (await getActiveSleep(db))?.id ?? 0;

    await expect(listSleepsOverlapping(db, DAY, NEXT)).resolves.toHaveLength(1);
    await deleteSleep(db, id);
    await expect(listSleepsOverlapping(db, DAY, NEXT)).resolves.toHaveLength(0);
  });
});
