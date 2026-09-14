import {
  daysSinceBirth,
  formatCalendarDate,
  fromCalendarDate,
  toCalendarDate,
} from './date';

describe('toCalendarDate', () => {
  it('현지 달력 기준으로 만든다', () => {
    expect(toCalendarDate(new Date(2026, 7, 27))).toBe('2026-08-27');
  });

  it('월과 일을 두 자리로 채운다', () => {
    expect(toCalendarDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('현지 자정 직후에도 그날 날짜다', () => {
    // toISOString()을 쓰면 UTC로 밀려 전날이 나올 수 있는 시각이다.
    expect(toCalendarDate(new Date(2026, 7, 27, 0, 30))).toBe('2026-08-27');
  });
});

describe('fromCalendarDate', () => {
  it('현지 자정으로 되돌린다', () => {
    const date = fromCalendarDate('2026-08-27');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(7);
    expect(date?.getDate()).toBe(27);
    expect(date?.getHours()).toBe(0);
  });

  it('형식이 틀리면 null이다', () => {
    expect(fromCalendarDate('2026-8-27')).toBeNull();
    expect(fromCalendarDate('')).toBeNull();
    expect(fromCalendarDate('오늘')).toBeNull();
  });

  it('존재하지 않는 날짜는 null이다', () => {
    // Date는 2026-02-31을 3월 3일로 조용히 넘긴다.
    expect(fromCalendarDate('2026-02-31')).toBeNull();
  });

  it('왕복해도 같다', () => {
    const value = '2026-02-29';
    // 2026년은 윤년이 아니므로 2월 29일은 없다.
    expect(fromCalendarDate(value)).toBeNull();
    expect(toCalendarDate(fromCalendarDate('2024-02-29')!)).toBe('2024-02-29');
  });
});

describe('formatCalendarDate', () => {
  it('사람이 읽는 형태로 바꾼다', () => {
    expect(formatCalendarDate('2026-08-27')).toBe('2026년 8월 27일');
  });

  it('해석할 수 없으면 원본을 그대로 둔다', () => {
    expect(formatCalendarDate('알 수 없음')).toBe('알 수 없음');
  });
});

describe('daysSinceBirth', () => {
  it('태어난 날은 0이다', () => {
    expect(daysSinceBirth('2026-08-27', new Date(2026, 7, 27))).toBe(0);
  });

  it('다음 날은 1이다', () => {
    expect(daysSinceBirth('2026-08-27', new Date(2026, 7, 28))).toBe(1);
  });

  it('하루 중 언제 보든 같은 값이다', () => {
    // 자정 직후와 자정 직전이 갈리면 화면의 숫자가 저녁에 하나 늘어난다.
    expect(daysSinceBirth('2026-08-27', new Date(2026, 7, 28, 0, 0))).toBe(1);
    expect(daysSinceBirth('2026-08-27', new Date(2026, 7, 28, 23, 59))).toBe(1);
  });

  it('달과 해를 넘어도 센다', () => {
    expect(daysSinceBirth('2026-08-27', new Date(2026, 8, 27))).toBe(31);
    expect(daysSinceBirth('2025-12-31', new Date(2026, 0, 1))).toBe(1);
  });

  it('윤년의 2월 29일을 지나도 맞다', () => {
    expect(daysSinceBirth('2024-02-28', new Date(2024, 2, 1))).toBe(2);
  });

  it('미래 생년월일은 null이다', () => {
    // 기기 시계를 되돌리면 저장된 값이 미래가 된다. `D+-3`을 내보내지 않는다.
    expect(daysSinceBirth('2026-08-27', new Date(2026, 7, 26))).toBeNull();
  });

  it('해석할 수 없는 날짜는 null이다', () => {
    expect(daysSinceBirth('2026-02-31', new Date(2026, 7, 27))).toBeNull();
    expect(daysSinceBirth('', new Date(2026, 7, 27))).toBeNull();
  });
});
