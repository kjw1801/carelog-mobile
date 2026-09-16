/**
 * WCAG 2.1 명암비.
 *
 * 이 프로젝트는 색을 고를 때마다 대비를 손으로 계산해 왔다. 다크 모드가 들어오면
 * 같은 조합을 두 벌 확인해야 해서, 계산을 코드로 옮기고 테스트로 고정한다.
 *
 * 기준(WCAG 2.1 AA):
 * - 본문 텍스트 4.5:1
 * - 큰 텍스트(18pt 이상, 또는 14pt 이상 굵게) 3:1
 * - 아이콘·구분선 같은 비텍스트 요소 3:1
 * - 비활성 컨트롤은 대상이 아니다
 */

/** `#rgb`와 `#rrggbb`를 0~255 세 값으로 푼다. `#`이 없으면 색으로 보지 않는다. */
function channels(color: string): [number, number, number] {
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    throw new Error(`색 형식이 아니다: ${color}`);
  }
  const hex = color.slice(1);
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** 감마를 편 선형 값. 0.03928이 아니라 0.04045가 sRGB 규격의 경계다. */
function linear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** 상대 휘도. */
export function luminance(color: string): number {
  const [r, g, b] = channels(color);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** 두 색의 명암비. 1(같은 색)에서 21(검정과 흰색) 사이다. 순서는 상관없다. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
