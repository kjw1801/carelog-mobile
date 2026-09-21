import {
  feedingDetail,
  getFeedingSummary,
  getLastFeeding,
  deleteFeeding,
  insertFeeding,
  todayFeedingLine,
  type FeedingSummary,
} from './feedings';
import { memoryDb } from './memory-db';

describe('feedingDetail', () => {
  it('모유는 위치를 붙인다', () => {
    expect(feedingDetail('breast', 'left', null)).toBe('모유 왼쪽');
    expect(feedingDetail('breast', 'both', null)).toBe('모유 양쪽');
  });

  it('분유는 양을 붙이고, 없으면 종류만 남긴다', () => {
    expect(feedingDetail('formula', null, 120)).toBe('분유 120ml');
    expect(feedingDetail('formula', null, null)).toBe('분유');
  });

  it('v4 기록은 양만 보여주지 않는다', () => {
    // 양만 적으면 분유로 오해한다. 추정하지 않으려고 unspecified를 뒀다.
    expect(feedingDetail('unspecified', null, 120)).toBe('기존 기록 · 120ml');
    expect(feedingDetail('unspecified', null, null)).toBe('기존 기록');
  });
});

function summary(over: Partial<FeedingSummary>): FeedingSummary {
  return { count: 0, breastCount: 0, formulaCount: 0, formulaMl: null, ...over };
}

describe('todayFeedingLine', () => {
  it('한 건도 없으면 0회가 아니라 아직 없음이다', () => {
    expect(todayFeedingLine(summary({}))).toBe('오늘 아직 없음');
  });

  it('종류별 횟수와 분유량을 적는다', () => {
    const line = todayFeedingLine(
      summary({ count: 5, breastCount: 3, formulaCount: 2, formulaMl: 240 })
    );
    expect(line).toBe('오늘 모유 3회 · 분유 2회 · 240ml');
  });

  it('양을 적지 않은 분유도 줄에 남는다', () => {
    // 합계 한 줄로 두면 여기서 분유가 사라진다. 종류별 횟수를 세는 이유다.
    expect(todayFeedingLine(summary({ count: 2, formulaCount: 2 }))).toBe('오늘 분유 2회');
  });

  it('0회인 종류는 적지 않는다', () => {
    expect(todayFeedingLine(summary({ count: 3, breastCount: 3 }))).toBe('오늘 모유 3회');
  });

  it('모유 + 분유가 전체보다 적으면 그 차이를 적는다', () => {
    // v4 기록이 섞인 날. 빼면 그 기록이 화면에서 사라진다.
    const line = todayFeedingLine(
      summary({ count: 6, breastCount: 3, formulaCount: 2, formulaMl: 240 })
    );
    expect(line).toBe('오늘 모유 3회 · 분유 2회 · 240ml · 기존 기록 1회');
  });

  it('v4 기록만 있는 날도 센다', () => {
    expect(todayFeedingLine(summary({ count: 1 }))).toBe('오늘 기존 기록 1회');
  });
});

const DAY = new Date(2026, 8, 18).getTime();
const NEXT = new Date(2026, 8, 19).getTime();

describe('getFeedingSummary', () => {
  it('범위 안의 행만 종류별로 세고 분유량을 더한다', async () => {
    const db = await memoryDb();
    for (const side of ['left', 'right', 'both'] as const) {
      await insertFeeding(db, {
        occurredAt: DAY + 1,
        kind: 'breast',
        side,
        amountMl: null,
        note: null,
      });
    }
    await insertFeeding(db, {
      occurredAt: DAY + 2,
      kind: 'formula',
      side: null,
      amountMl: 240,
      note: null,
    });
    await insertFeeding(db, {
      occurredAt: DAY + 3,
      kind: 'formula',
      side: null,
      amountMl: null,
      note: null,
    });
    // unspecified는 타입이 새 생성을 막으므로 마이그레이션된 행을 흉내 낸다.
    await db.runAsync(
      `INSERT INTO feedings (occurred_at, kind, side, amount_ml, note, created_at, updated_at)
       VALUES (?, 'unspecified', NULL, 90, NULL, 0, 0)`,
      DAY + 4
    );
    // 경계 밖. 끝 조건이 <= 로 바뀌면 여기서 걸린다.
    await insertFeeding(db, {
      occurredAt: NEXT,
      kind: 'formula',
      side: null,
      amountMl: 500,
      note: null,
    });

    await expect(getFeedingSummary(db, DAY, NEXT)).resolves.toEqual({
      count: 6,
      breastCount: 3,
      formulaCount: 2,
      formulaMl: 240,
    });
  });

  it('분유 양을 하나도 적지 않으면 횟수는 남고 양만 null이다', async () => {
    const db = await memoryDb();
    await insertFeeding(db, {
      occurredAt: DAY + 1,
      kind: 'formula',
      side: null,
      amountMl: null,
      note: null,
    });
    await insertFeeding(db, {
      occurredAt: DAY + 2,
      kind: 'formula',
      side: null,
      amountMl: null,
      note: null,
    });

    await expect(getFeedingSummary(db, DAY, NEXT)).resolves.toEqual({
      count: 2,
      breastCount: 0,
      formulaCount: 2,
      formulaMl: null,
    });
  });

  it('기록이 없으면 0과 null이다', async () => {
    const db = await memoryDb();
    await expect(getFeedingSummary(db, DAY, NEXT)).resolves.toEqual({
      count: 0,
      breastCount: 0,
      formulaCount: 0,
      formulaMl: null,
    });
  });
});

describe('insertFeeding / deleteFeeding', () => {
  const breast = {
    occurredAt: DAY + 1,
    kind: 'breast',
    side: 'left',
    amountMl: null,
    note: null,
  } as const;

  it('두 번째 DELETE는 false다', async () => {
    const db = await memoryDb();
    await insertFeeding(db, breast);
    const id = (await getLastFeeding(db))?.id ?? 0;

    await expect(deleteFeeding(db, id)).resolves.toBe(true);
    // 여기서 true가 나오면 지운 것이 없는데도 `삭제했습니다`가 뜬다.
    await expect(deleteFeeding(db, id)).resolves.toBe(false);
  });

  it('지우면 마지막 수유가 이전 기록으로 돌아간다', async () => {
    const db = await memoryDb();
    await insertFeeding(db, breast);
    await insertFeeding(db, { ...breast, occurredAt: DAY + 2, side: 'right' });

    const second = await getLastFeeding(db);
    expect(second?.side).toBe('right');
    await deleteFeeding(db, second?.id ?? 0);
    expect((await getLastFeeding(db))?.side).toBe('left');
  });
});
