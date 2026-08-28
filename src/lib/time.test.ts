import { formatDuration, formatDurationCompact } from './time';

const MIN = 60_000;
const HOUR = 60 * MIN;

describe('formatDurationCompact', () => {
  it('1분 미만은 그대로 알린다', () => {
    expect(formatDurationCompact(30_000)).toBe('1분 미만');
  });

  it('1시간 미만은 분을 유지한다', () => {
    expect(formatDurationCompact(45 * MIN)).toBe('45분');
    expect(formatDurationCompact(59 * MIN)).toBe('59분');
  });

  it('정확히 정시간이면 그대로 쓴다', () => {
    expect(formatDurationCompact(HOUR)).toBe('1시간');
    expect(formatDurationCompact(16 * HOUR)).toBe('16시간');
  });

  it('버린 분이 있으면 +를 붙인다', () => {
    // 반올림이 아니라 버림이다. 59분을 버려도 시간은 그대로다.
    expect(formatDurationCompact(HOUR + 1 * MIN)).toBe('1시간+');
    expect(formatDurationCompact(HOUR + 59 * MIN)).toBe('1시간+');
  });

  it('하루치 수면도 한 덩어리로 짧게 만든다', () => {
    // 반 폭 카드에 두 줄로 접히던 길이다.
    expect(formatDuration(16 * HOUR + 20 * MIN)).toBe('16시간 20분');
    expect(formatDurationCompact(16 * HOUR + 20 * MIN)).toBe('16시간+');
  });

  it('음수는 0으로 본다', () => {
    expect(formatDurationCompact(-1000)).toBe('1분 미만');
  });
});
