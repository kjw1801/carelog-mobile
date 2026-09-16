import { useColorScheme } from 'react-native';

import { palettes, type Colors, type ThemeName } from './colors';
import { resolveTheme } from './preference';
import { useThemePreference } from './provider';

/**
 * 지금 테마.
 *
 * 설정이 `시스템 설정`일 때만 기기를 본다. `useColorScheme()`은 기기 설정이 바뀌면
 * 다시 그려 준다.
 */
export function useThemeName(): ThemeName {
  const { preference } = useThemePreference();
  const systemScheme = useColorScheme();
  return resolveTheme(preference, systemScheme);
}

/**
 * 지금 테마의 색.
 *
 * 스타일은 모듈 최상단 `StyleSheet.create`가 아니라 이 색으로 만들어야 한다.
 * 최상단은 한 번만 계산되어 테마가 바뀌어도 그대로다.
 */
export function useColors(): Colors {
  return palettes[useThemeName()];
}
