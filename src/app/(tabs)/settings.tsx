import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getBaby, saveBaby } from '@/db/baby';
import { formatCalendarDate, fromCalendarDate, toCalendarDate } from '@/lib/date';

export default function SettingsScreen() {
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>아이 이름</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="예: 정우"
          placeholderTextColor="#b0b0b5"
          returnKeyType="done"
          maxLength={20}
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
            설정을 불러오지 못했습니다. 앱을 다시 열어 주세요. 지금 저장하면 기존
            설정이 지워질 수 있어 저장을 막아 두었습니다.
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

        <View style={styles.about}>
          {/* 이름을 하드코딩하면 표시 이름을 바꿀 때 이 화면만 뒤처진다.
              읽지 못했을 때의 대체 문구도 이름이 아니어야 한다. */}
          <Text style={styles.aboutTitle}>
            {Constants.expoConfig?.name ?? '앱 정보'}
          </Text>
          <Text style={styles.aboutLine}>버전 {Constants.expoConfig?.version ?? '-'}</Text>
          {/* 자동 백업을 허용하므로 `기기에만 저장됩니다`라고 안내하지 않는다. */}
          <Text style={styles.aboutLine}>로그인 없이 사용할 수 있습니다.</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  // 검증 기기에서 behavior="padding"만으로는 마지막 버튼의 스크롤 여유가
  // 부족했다. 키보드를 띄운 채 끝까지 내려도 버튼에 닿도록 여백을 둔다.
  content: { padding: 20, paddingBottom: 120, gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#3a3a3c', marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e5',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#1c1c1e',
  },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e5',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  chipFlex: { flex: 1 },
  chipText: { fontSize: 17, color: '#1c1c1e' },
  clearButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#f0f0f3',
    justifyContent: 'center',
  },
  clearButtonText: { fontSize: 15, color: '#8a8a8e' },
  chipPlaceholder: { fontSize: 17, color: '#b0b0b5' },
  saveButton: {
    marginTop: 32,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: '#b0c9e5' },
  saveButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  error: { marginTop: 24, fontSize: 14, color: '#ff3b30', lineHeight: 20 },
  about: { marginTop: 40, gap: 4 },
  aboutTitle: { fontSize: 15, fontWeight: '600', color: '#3a3a3c' },
  aboutLine: { fontSize: 14, color: '#8a8a8e' },
});
