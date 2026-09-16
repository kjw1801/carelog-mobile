import { useColorScheme } from 'react-native';

import { palettes, type Colors } from './colors';

/**
 * 지금 테마의 색.
 *
 * `useColorScheme()`은 기기 설정이 바뀌면 다시 그려 준다. `null`을 돌려줄 수
 * 있으므로(초기 한 프레임, 또는 시스템 값을 못 읽는 경우) 라이트로 떨어뜨린다.
 *
 * 스타일은 모듈 최상단 `StyleSheet.create`가 아니라 이 색으로 만들어야 한다.
 * 최상단은 한 번만 계산되어 테마가 바뀌어도 그대로다.
 */
export function useColors(): Colors {
  return palettes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
