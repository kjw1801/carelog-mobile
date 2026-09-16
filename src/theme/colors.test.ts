import { contrastRatio } from '@/lib/contrast';

import { palettes, type Colors, type ThemeName } from './colors';

const THEMES: ThemeName[] = ['light', 'dark'];

/**
 * 본문 텍스트.
 *
 * **이 앱에는 큰 글자가 사실상 없다.** WCAG 기준은 굵게 18.66px 또는 보통 24px
 * 이상인데, 버튼 글자는 17px 굵게, 칩은 16px이다. 그래서 예외 없이 4.5:1이다.
 */
const BODY = 4.5;

/** 아이콘·점·테두리처럼 글자가 아닌 것과, 컨트롤이 배경과 갈라지는 경계. */
const NON_TEXT = 3;

/**
 * 화면에 실제로 함께 나오는 조합만 검사한다.
 *
 * 토큰을 전부 곱해 검사하면 쓰지도 않는 조합 때문에 팔레트가 묶인다.
 * 여기 없는 조합을 화면에서 새로 만들면 이 표에 한 줄을 더한다.
 */
const PAIRS: [keyof Colors, keyof Colors, number, string][] = [
  // 글자
  ['text', 'surface', BODY, '본문 · 카드와 목록'],
  ['text', 'background', BODY, '본문 · 화면 배경'],
  ['text', 'surfaceMuted', BODY, '칩 글자 16px'],
  ['textLabel', 'background', BODY, '폼 라벨 · 설정'],
  ['textLabel', 'surface', BODY, '폼 라벨 · 모달'],
  ['textMuted', 'surface', BODY, '보조 문구 · 카드'],
  ['textMuted', 'background', BODY, '보조 문구 · 화면 배경'],
  ['textMuted', 'surfaceMuted', BODY, '보조 문구 · 칩'],
  ['textPlaceholder', 'surface', BODY, '자리글자와 빈 값'],
  ['accentText', 'background', BODY, '처리방침 링크'],
  ['accentText', 'surfaceAccent', BODY, '`지금` 칩 글자'],
  ['danger', 'surface', BODY, '삭제 · 모달'],
  ['danger', 'background', BODY, '오류 · 설정'],

  // 채운 버튼 위의 글자 — 17px 굵게라 큰 글자가 아니다
  ['onAccent', 'accent', BODY, '저장 버튼 글자'],
  ['onAccent', 'diaper', BODY, '기저귀 버튼 글자'],
  ['onAccent', 'sleepIdle', BODY, '수면 시작 글자'],
  ['onAccent', 'sleepActive', BODY, '수면 중 글자'],
  ['onAccent', 'sleepOverdue', BODY, '12시간 초과 글자'],

  // 목록의 색 점과 버튼 위 아이콘
  ['accent', 'surface', NON_TEXT, '수유 점'],
  ['diaper', 'surface', NON_TEXT, '기저귀 점'],
  ['sleepDot', 'surface', NON_TEXT, '수면 점'],
  ['sleepIconIdle', 'sleepIdle', NON_TEXT, '침대 아이콘'],

  // 입력칸 테두리.
  // 폼 화면은 바탕이 `surface`이고 입력칸에 채움이 없다. **테두리가 입력 영역을
  // 알려주는 유일한 수단이라** 3:1을 받는다. 칩은 자기 글자가 곧 식별 수단이라
  // 여기 넣지 않는다.
  ['border', 'surface', NON_TEXT, '입력칸 테두리 · 모달'],
  ['border', 'background', NON_TEXT, '입력칸 테두리 · 설정'],

  // 채운 버튼이 화면 배경과 갈라지는 경계.
  // 다크에서 이 검사가 없으면 어두운 버튼이 검은 배경에 녹아 버린다.
  ['accent', 'background', NON_TEXT, '저장 버튼 경계'],
  ['diaper', 'background', NON_TEXT, '기저귀 버튼 경계'],
  ['sleepIdle', 'background', NON_TEXT, '수면 시작 버튼 경계'],
  ['sleepActive', 'background', NON_TEXT, '수면 중 버튼 경계'],
  ['sleepOverdue', 'background', NON_TEXT, '12시간 초과 버튼 경계'],
];

describe('팔레트 구조', () => {
  it('라이트와 다크가 같은 토큰을 갖는다', () => {
    // 한쪽에만 있는 토큰은 그 테마에서 `undefined`가 되어 색이 통째로 사라진다.
    expect(Object.keys(palettes.dark).sort()).toEqual(Object.keys(palettes.light).sort());
  });

  it.each(THEMES)('%s의 모든 값이 여섯 자리 색이다', (theme) => {
    for (const [token, value] of Object.entries(palettes[theme])) {
      expect(`${token}=${value}`).toMatch(/=#[0-9a-f]{6}$/);
    }
  });
});

describe('명암비', () => {
  for (const theme of THEMES) {
    describe(theme, () => {
      it.each(PAIRS)('%s on %s ≥ %s:1 — %s', (fg, bg, min) => {
        const colors = palettes[theme];
        expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(min);
      });
    });
  }
});

describe('비활성 저장 버튼', () => {
  // WCAG는 비활성 컨트롤을 대비 기준에서 뺀다. 다만 눌리지 않는다는 것이 보여야
  // 하므로, 활성 상태와 구분은 되어야 한다.
  it.each(THEMES)('%s에서 활성 강조색과 구분된다', (theme) => {
    const { accent, accentDisabled } = palettes[theme];
    expect(accentDisabled).not.toBe(accent);
    expect(contrastRatio(accent, accentDisabled)).toBeGreaterThan(1.5);
  });
});
