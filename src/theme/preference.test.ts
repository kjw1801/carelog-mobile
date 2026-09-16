import { parseThemePreference, resolveTheme, THEME_PREFERENCES } from './preference';

describe('parseThemePreference', () => {
  it.each(THEME_PREFERENCES)('%s를 그대로 읽는다', (value) => {
    expect(parseThemePreference(value)).toBe(value);
  });

  it('저장된 값이 없으면 시스템을 따른다', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference(undefined)).toBe('system');
  });

  it('모르는 값이면 시스템을 따른다', () => {
    // 옛 버전이 다른 값을 넣어 뒀거나 저장이 깨진 경우다. 던지지 않는다.
    expect(parseThemePreference('')).toBe('system');
    expect(parseThemePreference('auto')).toBe('system');
    expect(parseThemePreference('DARK')).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('시스템 설정이면 기기를 따른다', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', 'light')).toBe('light');
  });

  it('기기 값을 모르면 라이트다', () => {
    // `useColorScheme()`은 `null`이나 `unspecified`를 줄 수 있다.
    expect(resolveTheme('system', null)).toBe('light');
    expect(resolveTheme('system', undefined)).toBe('light');
    expect(resolveTheme('system', 'unspecified')).toBe('light');
  });

  it('직접 고른 값은 기기를 무시한다', () => {
    expect(resolveTheme('dark', 'light')).toBe('dark');
    expect(resolveTheme('light', 'dark')).toBe('light');
  });
});
