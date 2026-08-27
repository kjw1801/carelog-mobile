export type ParsedAmount =
  | { ok: true; value: number | null }
  | { ok: false; message: string };

/**
 * 수유량 입력을 판정한다.
 *
 * 빈 문자열 판정과 숫자 변환을 분리한다. `Number('')`는 `0`이라
 * 먼저 걸러내지 않으면 "입력하지 않음"과 "0 입력"이 뭉개진다.
 * 입력하지 않으면 `null`이고, 이것은 `0ml`과 다른 사실이다.
 */
export function parseAmount(raw: string): ParsedAmount {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: '수유량은 숫자만 입력할 수 있습니다.' };
  }
  const value = Number(trimmed);
  if (value <= 0) {
    return { ok: false, message: '수유량은 0보다 커야 합니다. 모르면 비워 두세요.' };
  }
  return { ok: true, value };
}
