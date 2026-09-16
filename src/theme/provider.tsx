import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Appearance } from 'react-native';

import {
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
} from './preference';

type ThemePreferenceValue = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceValue>({
  preference: 'system',
  setPreference: () => {},
});

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  // 초기값을 동기로 읽는다. 뒤늦게 읽으면 첫 프레임이 시스템 테마로 깜빡인다.
  const [preference, setStored] = useState(readThemePreference);

  // 네이티브 대화상자는 우리가 그리지 않는다. `Alert`과 날짜·시각 선택기까지
  // 같은 테마로 맞추려면 OS의 야간 모드 자체를 바꿔야 한다.
  // `'unspecified'`가 시스템 복귀 값이다 — 이 버전에 `'auto'`는 없다.
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setStored(next);
    try {
      saveThemePreference(next);
    } catch (error) {
      // 이번 실행에는 이미 적용됐지만 다음 실행에는 남지 않는다. 조용히 넘어가면
      // 사용자는 유지된 줄 알았다가 재시작 후 되돌아온 것을 보게 된다.
      console.warn('화면 모드를 저장하지 못했습니다', error);
      Alert.alert('화면 모드를 저장하지 못했습니다', '이번 실행에만 적용됩니다.');
    }
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceValue {
  return useContext(ThemePreferenceContext);
}
