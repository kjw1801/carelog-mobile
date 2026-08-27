/**
 * 오늘의 경계. 기기 현지 시간 00:00 이상, 다음 날 00:00 미만.
 *
 * 끝 시각을 `시작 + 86400000`으로 만들지 않는다. 서머타임 지역에서는
 * 하루가 24시간이 아니다. 현지 달력으로 두 자정을 각각 만들어 epoch로 바꾼다.
 */
export function todayRange(now: Date = new Date()): { start: number; end: number } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/** "1시간 24분 전". */
export function formatElapsed(from: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - from) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest}분 전` : `${hours}시간 ${rest}분 전`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "14:32". */
export function formatTimeOfDay(at: number): string {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "8월 27일". */
export function formatDay(at: number): string {
  const d = new Date(at);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 같은 현지 날짜인지. */
export function isSameDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}
