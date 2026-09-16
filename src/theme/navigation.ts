import { DarkTheme, DefaultTheme } from 'expo-router';

import { palettes, type ThemeName } from './colors';

/**
 * 헤더와 탭 바의 색.
 *
 * 이 둘은 우리가 그리는 것이 아니라 내비게이션이 그리므로, `StyleSheet`가 아니라
 * 테마 객체로 넘겨야 한다. 본문만 어둡게 하면 헤더와 탭 바만 밝게 남는다.
 *
 * `DefaultTheme`/`DarkTheme`은 `expo-router/react-navigation`에도 있지만 그 경로는
 * deprecated다. 루트 `expo-router`에서 가져온다.
 */
export function navigationTheme(name: ThemeName) {
  const c = palettes[name];
  const base = name === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: name === 'dark',
    colors: {
      ...base.colors,
      primary: c.accent,
      // 화면 배경. 라우트가 그리기 전 한 프레임과 화면 전환 중에 보인다.
      background: c.background,
      // 헤더와 탭 바.
      card: c.surface,
      text: c.text,
      border: c.border,
      notification: c.danger,
    },
  };
}
