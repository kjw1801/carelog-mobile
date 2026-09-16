import Storage from 'expo-sqlite/kv-store';

import { type ThemeName } from './colors';

/**
 * 화면 모드 설정.
 *
 * 단순 on/off가 아니라 3단이다. on/off는 "끄면 무엇이 되는지"가 정의되지 않아,
 * 기기를 다크로 쓰는 사용자가 앱만 라이트로 되돌릴 방법이 사라진다.
 *
 * 저장은 `expo-sqlite/kv-store`를 쓴다. 이미 설치된 패키지 안에 있고, 앱 환경설정
 * 하나 때문에 육아 기록 스키마를 올릴 이유가 없다.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export const THEME_PREFERENCE_LABEL: Record<ThemePreference, string> = {
  system: '시스템 설정',
  light: '밝게',
  dark: '어둡게',
};

const KEY = 'theme-preference';

/** 저장된 문자열을 설정값으로 읽는다. 없거나 모르는 값이면 시스템을 따른다. */
export function parseThemePreference(raw: string | null | undefined): ThemePreference {
  return THEME_PREFERENCES.includes(raw as ThemePreference)
    ? (raw as ThemePreference)
    : 'system';
}

/**
 * 설정과 기기 테마로 실제 테마를 정한다.
 *
 * `system`일 때만 기기를 본다. 기기 값은 `null`이나 `unspecified`로 올 수 있어
 * `dark`가 아니면 전부 라이트로 떨어뜨린다.
 */
export function resolveTheme(
  preference: ThemePreference,
  systemScheme: string | null | undefined
): ThemeName {
  if (preference !== 'system') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

/**
 * 저장된 설정을 **동기로** 읽는다.
 *
 * 비동기로 읽으면 첫 프레임에 시스템 테마가 보였다가 뒤늦게 바뀐다. 동기 읽기가
 * 막히는 환경(웹, 원격 디버깅)에서는 던지므로 시스템을 따르는 값으로 떨어뜨린다.
 */
export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(Storage.getItemSync(KEY));
  } catch {
    return 'system';
  }
}

/**
 * 설정을 **동기로** 저장한다.
 *
 * 비동기로 쓰면 완료 순서가 보장되지 않는다. 세 칩을 빠르게 눌러 비교하면 화면은
 * 마지막 선택인데 늦게 끝난 앞선 쓰기가 이기고, 재시작 후 이전 선택이 돌아온다.
 * 한 행짜리 값이고 읽기도 `getItemSync`라 저장도 동기로 맞춘다.
 *
 * 실패하면 던진다. 삼키면 사용자는 유지된 줄 알았다가 재시작 후 되돌아온다.
 */
export function saveThemePreference(preference: ThemePreference): void {
  Storage.setItemSync(KEY, preference);
}
