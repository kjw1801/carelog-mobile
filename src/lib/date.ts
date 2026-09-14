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

/**
 * 생년월일부터 오늘까지의 경과 일수. **태어난 날이 `0`이다.**
 *
 * 이 앱의 `D+n`은 출생일을 `D+0`으로 센다. 다른 규칙으로 세는 표기와 섞이지
 * 않도록 세는 기준은 이 함수 하나에만 둔다.
 *
 * **epoch 차이를 그대로 나누지 않는다.** 둘 다 달력 날짜라, 서머타임이 있는
 * 지역에서는 하루가 23시간이나 25시간이 되어 경계에서 날짜가 하나 밀린다.
 * 현지 자정끼리 빼고 반올림하면 그 ±1시간이 흡수된다.
 *
 * 해석할 수 없는 날짜와 **미래 생년월일은 `null`**이다. 입력기가 미래를 막고
 * 있지만, 기기 시계를 되돌리면 이미 저장된 값이 미래가 될 수 있다.
 * 그때 `D+-3` 같은 문자열을 화면에 내보내지 않는다.
 */
export function daysSinceBirth(birthDate: string, today: Date): number | null {
  const birth = fromCalendarDate(birthDate);
  if (!birth) return null;
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((midnight.getTime() - birth.getTime()) / 86_400_000);
  return days < 0 ? null : days;
}
