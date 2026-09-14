/**
 * 서머타임이 있는 지역에서만 의미가 있는 검증이라 기본 스위트와 분리했다.
 * `npm run test:dst`가 `TZ=America/New_York`를 주고 이 파일만 돌린다.
 *
 * 한국은 서머타임이 없다. KST로 돌리면 하루가 항상 24시간이라 아래 케이스가
 * 전부 통과해 버리고 아무것도 증명하지 못한다. 그래서 첫 테스트로 환경부터
 * 확인한다. Jest 워커는 시작할 때 시간대를 정하므로 파일 안에서
 * `process.env.TZ`를 바꿔도 소용이 없다 — 실행할 때 줘야 한다.
 */
import { daysSinceBirth } from './date';

describe('daysSinceBirth — 서머타임', () => {
  it('서머타임이 있는 지역에서 돌고 있다', () => {
    // 이게 실패하면 아래 통과는 의미가 없다. 조용히 건너뛰지 않고 소리를 낸다.
    expect(new Date(2026, 0, 1).getTimezoneOffset()).not.toBe(
      new Date(2026, 6, 1).getTimezoneOffset()
    );
  });

  it('23시간짜리 날을 지나도 하루는 하루다', () => {
    // 2026-03-08은 새벽 2시가 3시로 건너뛰어 자정부터 다음 자정까지가 23시간이다.
    expect(daysSinceBirth('2026-03-08', new Date(2026, 2, 9))).toBe(1);
  });

  it('25시간짜리 날을 지나도 하루는 하루다', () => {
    // 2026-11-01은 새벽 2시가 1시로 돌아가 자정부터 다음 자정까지가 25시간이다.
    expect(daysSinceBirth('2026-11-01', new Date(2026, 10, 2))).toBe(1);
  });

  it('봄 전환을 가로지르는 기간을 정확히 센다', () => {
    // 실제 간격은 29.958일이다. 내림으로 계산하면 29가 나온다.
    expect(daysSinceBirth('2026-03-01', new Date(2026, 2, 31))).toBe(30);
  });

  it('가을 전환을 가로지르는 기간을 정확히 센다', () => {
    // 실제 간격은 14.042일이다.
    expect(daysSinceBirth('2026-10-25', new Date(2026, 10, 8))).toBe(14);
  });
});
