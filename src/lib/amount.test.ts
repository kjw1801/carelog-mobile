import { parseAmount } from './amount';

describe('parseAmount', () => {
  it('빈 입력은 null이다. 0이 아니다', () => {
    expect(parseAmount('')).toEqual({ ok: true, value: null });
    expect(parseAmount('   ')).toEqual({ ok: true, value: null });
  });

  it('양의 정수는 그대로 통과한다', () => {
    expect(parseAmount('120')).toEqual({ ok: true, value: 120 });
    expect(parseAmount(' 5 ')).toEqual({ ok: true, value: 5 });
  });

  it('0은 거부한다', () => {
    // 0ml 기록은 `마지막 수유` 시각을 갱신해 핵심 숫자를 오염시킨다.
    expect(parseAmount('0').ok).toBe(false);
  });

  it('음수·소수·문자는 거부한다', () => {
    expect(parseAmount('-10').ok).toBe(false);
    expect(parseAmount('1.5').ok).toBe(false);
    expect(parseAmount('120ml').ok).toBe(false);
    expect(parseAmount('백이십').ok).toBe(false);
  });

  it('안전 정수 범위를 넘으면 입력 오류로 돌려준다', () => {
    // 그냥 두면 SQLite에 REAL로 바인딩돼 typeof CHECK에 걸리고,
    // 사용자에게는 입력 오류가 아니라 저장 실패로 보인다.
    expect(parseAmount(String(Number.MAX_SAFE_INTEGER))).toEqual({
      ok: true,
      value: Number.MAX_SAFE_INTEGER,
    });
    expect(parseAmount('99999999999999999999').ok).toBe(false);
  });
});
