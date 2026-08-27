/**
 * 달력 날짜 `YYYY-MM-DD` 취급.
 *
 * 이 파일의 값은 **epoch가 아니다.** 생년월일처럼 특정 순간이 아니라 달력상의
 * 날짜인 값에 쓴다. epoch로 두면 시간대가 바뀔 때 날짜가 밀린다.
 * `time.ts`의 함수들은 전부 epoch 기준이므로 여기 값에 그대로 쓰면 안 된다.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** 현지 달력 기준으로 `YYYY-MM-DD`를 만든다. `toISOString()`은 UTC라 쓰지 않는다. */
export function toCalendarDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD`를 현지 자정 Date로 되돌린다. 선택기에 넘길 때 쓴다. */
export function fromCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  // 2026-02-31 같은 값은 Date가 조용히 넘겨버리므로 되짚어 확인한다.
  return toCalendarDate(date) === value ? date : null;
}

/** "2026년 8월 27일". */
export function formatCalendarDate(value: string): string {
  const date = fromCalendarDate(value);
  if (!date) return value;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}
