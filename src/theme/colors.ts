/**
 * 라이트·다크 공통 색상 토큰.
 *
 * 색을 화면마다 박아 두면 다크 모드를 넣을 때 여섯 파일을 각각 고쳐야 하고,
 * 같은 회색이 어디서는 보조 문구고 어디서는 테두리라 무엇을 바꿔야 하는지도
 * 알 수 없다. **의미로 이름을 붙이고 두 벌을 같은 자리에 둔다.**
 *
 * 대비는 `colors.test.ts`가 실제 조합으로 검증한다. 값을 바꾸면 테스트가 먼저
 * 알려준다. 라이트 값 여섯 개는 기존 색이 WCAG AA에 미달해 바꾼 것이다.
 */

export type ThemeName = 'light' | 'dark';

export type Colors = {
  /**
   * 화면 배경.
   *
   * **`surface` 위에 얹히는 요소의 채움으로 쓰지 않는다** — 다크에서 `#000`이라
   * 검은 구멍이 된다. 면 위의 칩은 `surfaceMuted`를 쓴다.
   */
  background: string;
  /** 카드·입력칸·목록처럼 배경 위에 얹히는 면. 폼 화면의 바탕이기도 하다. */
  surface: string;
  /** 칩과 보조 버튼의 바탕. */
  surfaceMuted: string;
  /** `지금` 칩처럼 강조색을 옅게 깐 바탕. */
  surfaceAccent: string;
  /** 입력칸 테두리. */
  border: string;

  /** 본문. */
  text: string;
  /** 폼 라벨. 본문보다 한 단계 여리다. */
  textLabel: string;
  /** 보조 문구. 카드 라벨, 메모, 힌트. */
  textMuted: string;
  /** 입력 전 자리글자와 `선택 안 함` 같은 빈 값. */
  textPlaceholder: string;

  /** 강조. 저장 버튼, 선택된 칩, 수유 표시. 항상 `onAccent`를 얹는다. */
  accent: string;
  /** 강조색을 **글자로** 쓸 때. 면에 깔 때보다 어두워야 본문 대비를 만족한다. */
  accentText: string;
  /** 비활성 저장 버튼. 비활성 컨트롤이라 대비 기준의 대상이 아니다. */
  accentDisabled: string;
  /** 강조색 위에 얹는 글자. */
  onAccent: string;

  /** 삭제와 오류. */
  danger: string;
  /** 기저귀. 버튼과 목록 점에 함께 쓴다. */
  diaper: string;

  /** 수면 시작 버튼. */
  sleepIdle: string;
  /** 수면 중 버튼. */
  sleepActive: string;
  /** 12시간을 넘긴 수면 버튼. */
  sleepOverdue: string;
  /** 기록 목록의 수면 점. */
  sleepDot: string;
};

const light: Colors = {
  background: '#f2f2f7',
  surface: '#ffffff',
  surfaceMuted: '#f0f0f3',
  surfaceAccent: '#e5f0ff',
  border: '#8a8a8e',

  text: '#1c1c1e',
  textLabel: '#3a3a3c',
  textMuted: '#68686b',
  textPlaceholder: '#767679',

  accent: '#0b6fd6',
  accentText: '#0a5cbf',
  accentDisabled: '#b0c9e5',
  onAccent: '#ffffff',

  danger: '#c9271c',
  diaper: '#217a3a',

  sleepIdle: '#3f3d56',
  sleepActive: '#b85c00',
  sleepOverdue: '#9f3a20',
  sleepDot: '#5b597a',
};

/**
 * 다크 팔레트.
 *
 * 면과 글자는 전부 다른 값이다. 같은 값을 쓰는 것은 채워진 버튼 색과 `onAccent`
 * 뿐이다 — 버튼은 자기 색 위에 글자를 얹으므로 화면 배경이 바뀌어도 글자
 * 대비가 그대로 유지된다.
 *
 * 다만 **버튼이 배경과 구분되는지는 별개 문제다.** `sleepIdle`의 `#3f3d56`은 검은
 * 배경에서 2.01:1이라 버튼 경계가 사라져 `#5f5b80`으로 올렸다. 나머지 버튼 색은
 * 검은 배경에서 3:1을 넘겨 그대로 둔다.
 */
const dark: Colors = {
  background: '#000000',
  surface: '#1c1c1e',
  surfaceMuted: '#2c2c2e',
  surfaceAccent: '#0b2b45',
  border: '#6b6b70',

  text: '#f2f2f7',
  textLabel: '#d1d1d6',
  textMuted: '#98989d',
  textPlaceholder: '#8e8e93',

  accent: '#0b6fd6',
  accentText: '#64b5ff',
  accentDisabled: '#24405e',
  onAccent: '#ffffff',

  danger: '#ff6961',
  diaper: '#217a3a',

  sleepIdle: '#5f5b80',
  sleepActive: '#b85c00',
  sleepOverdue: '#9f3a20',
  sleepDot: '#8a87ad',
};

export const palettes: Record<ThemeName, Colors> = { light, dark };
