import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getBaby, saveBaby } from '@/db/baby';
import { formatCalendarDate, fromCalendarDate, toCalendarDate } from '@/lib/date';
import { clampName } from '@/lib/name';
import { type Colors } from '@/theme/colors';
import { THEME_PREFERENCE_LABEL, THEME_PREFERENCES } from '@/theme/preference';
import { useThemePreference } from '@/theme/provider';
import { useColors } from '@/theme/useColors';

/**
 * Play는 처리방침 링크를 콘솔과 **앱 안** 양쪽에 요구한다. 콘솔에만 넣으면 요건을
 * 채우지 못한다. 문서 원본은 `docs/privacy.html`이고 GitHub Pages가 이 주소로
 * 서빙한다. 콘솔에 등록한 주소와 같아야 하므로 바꿀 때 양쪽을 함께 고친다.
 */
const PRIVACY_URL = 'https://kjw1801.github.io/carelog-mobile/privacy.html';

export default function SettingsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { preference, setPreference } = useThemePreference();
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  // 조회에 성공해야 true. 실패한 채로 저장하면 빈 화면 값이 기존 설정을 덮어쓴다.
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  // 저장 요청이 도는 동안 값을 바꾸면, 끝난 뒤 setName(trimmed)가 새 입력을
  // 덮거나 날짜가 화면과 DB로 갈린다. 입력 전체를 함께 잠근다.
  // setState는 다음 렌더에야 반영된다. 실제 잠금은 ref로 건다.
  const savingRef = useRef(false);

  // 포커스마다 읽지 않는다. 설정은 이 화면에서만 바뀌므로 다시 읽을 이유가 없고,
  // 포커스마다 덮어쓰면 탭을 오가는 것만으로 작성 중인 값이 사라진다.
  useEffect(() => {
    let alive = true;
    getBaby(db)
      .then((baby) => {
        if (!alive) return;
        // 행이 없는 것은 실패가 아니다. 처음 쓰는 사용자다.
        if (baby) {
          // **불러올 때 자르지 않는다.** 제한을 넣기 전에 저장된 긴 이름을 여기서
          // 자르면, 생년월일만 바꾸고 저장해도 이름이 조용히 영구 축약된다.
          // 사용자가 건드리지 않은 값을 이 화면이 마음대로 줄여서는 안 된다.
          // 새 제한은 `onChangeText`에서, 즉 직접 고칠 때만 적용한다.
          setName(baby.name ?? '');
          setBirthDate(baby.birth_date);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  function onPickBirthDate(_event: DateTimePickerChangeEvent, selected: Date) {
    setShowPicker(false);
    // 생년월일은 달력 날짜다. epoch로 두지 않는다.
    setBirthDate(toCalendarDate(selected));
  }

  async function onOpenPrivacy() {
    try {
      await Linking.openURL(PRIVACY_URL);
    } catch {
      // 열 브라우저가 없거나 실패한 경우. 주소를 그대로 보여 줘야 사용자가 직접
      // 찾아갈 수 있다. `열지 못했습니다`만 띄우면 방침에 닿을 길이 없어진다.
      Alert.alert('링크를 열지 못했습니다', PRIVACY_URL);
    }
  }

  async function onSave() {
    if (!loaded || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    Keyboard.dismiss();
    const trimmed = name.trim();
    try {
      await saveBaby(db, {
        name: trimmed === '' ? null : trimmed,
        birth_date: birthDate,
      });
      // 저장한 값으로 입력창을 맞춘다. 앞뒤 공백을 넣었다면 화면과 DB가 어긋난다.
      setName(trimmed);
      Alert.alert('저장했습니다');
    } catch {
      Alert.alert('저장하지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>아이 이름</Text>
        <TextInput
          style={styles.input}
          value={name}
          // `maxLength`는 글자 수만 세서 한글과 영문을 구분하지 못한다.
          // 헤더에 들어갈 폭으로 잘라야 `D+n`이 밀려나지 않는다.
          onChangeText={(text) => setName(clampName(text))}
          placeholder="예: 정우"
          placeholderTextColor={colors.textPlaceholder}
          returnKeyType="done"
          editable={loaded && !saving}
          accessibilityLabel="아이 이름"
        />

        <Text style={styles.label}>생년월일</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.chip, styles.chipFlex]}
            onPress={() => setShowPicker(true)}
            disabled={!loaded || saving}
            accessibilityRole="button"
            accessibilityLabel={
              birthDate
                ? `생년월일 ${formatCalendarDate(birthDate)}, 변경`
                : '생년월일, 선택하지 않음, 선택'
            }>
            <Text style={birthDate ? styles.chipText : styles.chipPlaceholder}>
              {birthDate ? formatCalendarDate(birthDate) : '선택하지 않음'}
            </Text>
          </Pressable>
          {/* 잘못 고른 날짜를 되돌릴 수단이 없으면 다시 비울 방법이 없다. */}
          {birthDate ? (
            <Pressable
              style={styles.clearButton}
              onPress={() => setBirthDate(null)}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="생년월일 선택 해제">
              <Text style={styles.clearButtonText}>선택 해제</Text>
            </Pressable>
          ) : null}
        </View>

        {loadFailed ? (
          <Text style={styles.error}>
            설정을 불러오지 못했습니다. 앱을 다시 열어 주세요. 지금 저장하면 기존 설정이 지워질 수
            있어 저장을 막아 두었습니다.
          </Text>
        ) : null}

        <Pressable
          style={[styles.saveButton, (!loaded || saving) && styles.saveButtonDisabled]}
          onPress={onSave}
          disabled={!loaded || saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: !loaded || saving }}>
          <Text style={styles.saveButtonText}>저장</Text>
        </Pressable>

        {/* 아이 정보와 달리 저장 버튼이 없다. 고르는 즉시 화면이 바뀌므로 눌러
            확인할 것이 없고, 되돌리려면 다시 고르면 된다. */}
        <Text style={styles.label}>화면 모드</Text>
        <View style={styles.row} accessibilityRole="radiogroup">
          {THEME_PREFERENCES.map((value) => {
            const selected = preference === value;
            return (
              <Pressable
                key={value}
                style={[styles.themeChip, selected && styles.themeChipSelected]}
                onPress={() => setPreference(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}>
                <Text style={[styles.themeChipText, selected && styles.themeChipTextSelected]}>
                  {THEME_PREFERENCE_LABEL[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.about}>
          {/* 이름을 하드코딩하면 표시 이름을 바꿀 때 이 화면만 뒤처진다.
              읽지 못했을 때의 대체 문구도 이름이 아니어야 한다. */}
          <Text style={styles.aboutTitle}>{Constants.expoConfig?.name ?? '앱 정보'}</Text>
          <Text style={styles.aboutLine}>버전 {Constants.expoConfig?.version ?? '-'}</Text>
          {/* 자동 백업을 허용하므로 `기기에만 저장됩니다`라고 안내하지 않는다. */}
          <Text style={styles.aboutLine}>로그인 없이 사용할 수 있습니다.</Text>
          <Pressable
            style={styles.aboutLinkButton}
            onPress={onOpenPrivacy}
            accessibilityRole="link"
            accessibilityLabel="개인정보 처리방침, 브라우저에서 열기">
            <Text style={styles.aboutLink}>개인정보 처리방침</Text>
          </Pressable>
        </View>

        {showPicker ? (
          <DateTimePicker
            value={(birthDate && fromCalendarDate(birthDate)) || new Date()}
            mode="date"
            maximumDate={new Date()}
            onValueChange={onPickBirthDate}
            onDismiss={() => setShowPicker(false)}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    // 검증 기기에서 behavior="padding"만으로는 마지막 버튼의 스크롤 여유가
    // 부족했다. 키보드를 띄운 채 끝까지 내려도 버튼에 닿도록 여백을 둔다.
    content: { padding: 20, paddingBottom: 120, gap: 8 },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textLabel,
      marginTop: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      backgroundColor: c.surface,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 17,
      color: c.text,
    },
    row: { flexDirection: 'row', gap: 8 },
    chip: {
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    chipFlex: { flex: 1 },
    chipText: { fontSize: 17, color: c.text },
    clearButton: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: c.surfaceMuted,
      justifyContent: 'center',
    },
    clearButtonText: { fontSize: 15, color: c.textMuted },
    chipPlaceholder: { fontSize: 17, color: c.textPlaceholder },
    themeChip: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 10,
      backgroundColor: c.surfaceMuted,
      alignItems: 'center',
    },
    themeChipSelected: { backgroundColor: c.accent },
    themeChipText: { fontSize: 16, color: c.text },
    themeChipTextSelected: { color: c.onAccent, fontWeight: '700' },
    saveButton: {
      marginTop: 32,
      paddingVertical: 18,
      borderRadius: 12,
      backgroundColor: c.accent,
      alignItems: 'center',
    },
    saveButtonDisabled: { backgroundColor: c.accentDisabled },
    saveButtonText: { fontSize: 17, fontWeight: '700', color: c.onAccent },
    error: { marginTop: 24, fontSize: 14, color: c.danger, lineHeight: 20 },
    about: { marginTop: 40, gap: 4 },
    aboutTitle: { fontSize: 15, fontWeight: '600', color: c.textLabel },
    aboutLine: { fontSize: 14, color: c.textMuted },
    // 글자 높이만으로는 터치 영역이 20dp도 되지 않는다. Material의 최소 터치 크기가
    // 48dp라 높이를 그만큼 준다. `alignSelf`가 없으면 가로로 늘어나 옆의 빈 곳을
    // 눌러도 브라우저가 열린다.
    aboutLinkButton: {
      alignSelf: 'flex-start',
      minHeight: 48,
      justifyContent: 'center',
    },
    // 면에 까는 `accent`를 글자로 쓰면 본문 대비에 못 미친다. 링크는 찾을 수
    // 있어야 의미가 있어서 `accentText`가 따로 있다.
    aboutLink: { fontSize: 14, color: c.accentText },
  });
}
