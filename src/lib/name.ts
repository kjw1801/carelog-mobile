/**
 * 아이 이름 입력 길이 제한.
 *
 * **글자 수가 아니라 폭으로 센다.** 한글은 영문보다 넓어서 같은 글자 수라도
 * 헤더에서 차지하는 자리가 다르다. 글자 수 하나로 제한하면 한글에 맞춘 값은
 * 영문에서 지나치게 짧고, 영문에 맞춘 값은 한글에서 헤더를 넘긴다.
 *
 * 실기기에서 20자 이름을 넣으면 헤더가 `이름의 오늘 · D+32`를 다 담지 못해
 * `의 오늘`과 `D+32`가 통째로 잘려 나갔다. 이름만 남고 정작 보려던 숫자가
 * 사라진다.
 *
 * 한글 한 글자를 2로, 나머지를 1로 세고 예산을 10으로 둔다.
 * 한글 5자, 영문 10자가 각각 딱 맞는 값이다.
 */

/**
 * 한글·한자·가나와 전각 문자. 이 범위 밖(영문·숫자·기호)은 전부 1로 센다.
 * 정밀한 폭 계산이 아니라 제한을 예측 가능하게 만드는 것이 목적이다.
 */
const WIDE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/u;

export const NAME_BUDGET = 10;

/** 문자 하나가 차지하는 몫. 한글은 2, 나머지는 1. */
function weight(char: string): number {
  return WIDE.test(char) ? 2 : 1;
}

/** 예산 기준으로 센 이름의 폭. */
export function nameWidth(value: string): number {
  let total = 0;
  // 코드 포인트 단위로 돈다. `value.length`는 이모지를 둘로 센다.
  for (const char of value) total += weight(char);
  return total;
}

/**
 * 예산을 넘는 뒷부분을 잘라낸다.
 *
 * 넘치는 글자를 **통째로** 버린다. 한글은 2를 차지하므로 예산이 1 남았을 때
 * 한글을 받으면 그 글자는 들어가지 않는다. 반 글자를 남기는 일은 없다.
 */
export function clampName(value: string): string {
  let total = 0;
  let out = '';
  for (const char of value) {
    const next = total + weight(char);
    if (next > NAME_BUDGET) break;
    total = next;
    out += char;
  }
  return out;
}
