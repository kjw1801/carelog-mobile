import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  DIAPER_KIND_LABEL,
  deleteDiaper,
  getDiaper,
  insertDiaper,
  updateDiaper,
  type DiaperKind,
} from '@/db/diapers';
import { formatDay, formatTimeOfDay, mergePickedDateTime } from '@/lib/time';

const KINDS: DiaperKind[] = ['pee', 'poo', 'both'];

export default function DiaperFormScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const diaperId = id ? Number(id) : null;
  const isEditing = diaperId !== null;

  const [occurredAt, setOccurredAt] = useState(() => Date.now());
  const [kind, setKind] = useState<DiaperKind>('pee');
  const [noteText, setNoteText] = useState('');
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [ready, setReady] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  // setState는 다음 렌더에야 반영된다. 실제 잠금은 ref로 건다.
  // insert는 UPSERT가 아니라, 연타하면 기록이 두 개 생긴다.
  const savingRef = useRef(false);

  useEffect(() => {
    if (diaperId === null) return;
    let alive = true;
    getDiaper(db, diaperId).then((row) => {
      if (!alive) return;
      if (!row) {
        Alert.alert('기록을 찾을 수 없습니다.');
        router.back();
        return;
      }
      setOccurredAt(row.occurred_at);
      setKind(row.kind);
      setNoteText(row.note ?? '');
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [db, diaperId]);

  function onPickerChange(_event: DateTimePickerChangeEvent, selected: Date) {
    const mode = picker;
    setPicker(null);

    if (mode) setOccurredAt(mergePickedDateTime(occurredAt, selected, mode));
  }

  async function onSave() {
    if (savingRef.current) return;
    // 미래 시각은 저장하지 않는다. "지금"이 계속 바뀌므로 DB CHECK로는
    // 표현할 수 없고 여기서 막아야 한다.
    if (occurredAt > Date.now()) {
      Alert.alert('입력을 확인해 주세요', '미래 시각은 기록할 수 없습니다.');
      return;
    }

    const note = noteText.trim();
    const input = { occurredAt, kind, note: note === '' ? null : note };

    savingRef.current = true;
    setSaving(true);
    try {
      if (diaperId === null) await insertDiaper(db, input);
      else await updateDiaper(db, diaperId, input);
      router.back();
    } catch {
      Alert.alert('저장하지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function onDelete() {
    if (diaperId === null || savingRef.current) return;
    Alert.alert('이 기저귀 기록을 삭제할까요?', '되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteDiaper(db, diaperId);
          router.back();
        },
      },
    ]);
  }

  if (!ready) return <View style={styles.container} />;

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? '기저귀 기록 수정' : '기저귀 기록' }} />

      <Text style={styles.label}>교체 시각</Text>
      <View style={styles.row}>
        <Pressable
          style={styles.chip}
          onPress={() => setPicker('date')}
          accessibilityRole="button"
          accessibilityLabel={`날짜 ${formatDay(occurredAt)}, 변경`}>
          <Text style={styles.chipText}>{formatDay(occurredAt)}</Text>
        </Pressable>
        <Pressable
          style={styles.chip}
          onPress={() => setPicker('time')}
          accessibilityRole="button"
          accessibilityLabel={`시각 ${formatTimeOfDay(occurredAt)}, 변경`}>
          <Text style={styles.chipText}>{formatTimeOfDay(occurredAt)}</Text>
        </Pressable>
        <Pressable
          style={styles.nowChip}
          onPress={() => setOccurredAt(Date.now())}
          accessibilityRole="button"
          accessibilityLabel="지금 시각으로 설정">
          <Text style={styles.nowChipText}>지금</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>종류</Text>
      <View style={styles.row}>
        {KINDS.map((value) => {
          const selected = kind === value;
          return (
            <Pressable
              key={value}
              style={[styles.kindChip, selected && styles.kindChipSelected]}
              onPress={() => setKind(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}>
              <Text style={[styles.kindText, selected && styles.kindTextSelected]}>
                {DIAPER_KIND_LABEL[value]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>메모 (선택)</Text>
      <TextInput
        style={styles.noteInput}
        value={noteText}
        onChangeText={setNoteText}
        placeholder="예: 발진 있음"
        placeholderTextColor="#b0b0b5"
        multiline
        accessibilityLabel="메모, 선택 입력"
      />

      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}>
        <Text style={styles.saveButtonText}>{isEditing ? '수정' : '저장'}</Text>
      </Pressable>

      {isEditing ? (
        <Pressable
          style={styles.deleteButton}
          onPress={onDelete}
          disabled={saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}>
          <Text style={styles.deleteButtonText}>삭제</Text>
        </Pressable>
      ) : null}

      {picker ? (
        <DateTimePicker
          value={new Date(occurredAt)}
          mode={picker}
          is24Hour
          maximumDate={picker === 'date' ? new Date() : undefined}
          onValueChange={onPickerChange}
          onDismiss={() => setPicker(null)}
        />
      ) : null}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  // 검증 기기에서 behavior="padding"만으로는 마지막 버튼의 스크롤 여유가
  // 부족했다. 키보드를 띄운 채 끝까지 내려도 버튼에 닿도록 여백을 둔다.
  content: { padding: 20, paddingBottom: 120, gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#3a3a3c', marginTop: 16 },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#f0f0f3',
  },
  chipText: { fontSize: 17, color: '#1c1c1e' },
  nowChip: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#e5f0ff',
  },
  nowChipText: { fontSize: 17, color: '#0a84ff', fontWeight: '600' },
  kindChip: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: '#f0f0f3',
    alignItems: 'center',
  },
  kindChipSelected: { backgroundColor: '#0a84ff' },
  kindText: { fontSize: 16, color: '#1c1c1e' },
  kindTextSelected: { color: '#fff', fontWeight: '700' },
  noteInput: {
    borderWidth: 1,
    borderColor: '#e0e0e5',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#1c1c1e',
    minHeight: 88,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 32,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: '#b0c9e5' },
  saveButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  deleteButton: { marginTop: 8, paddingVertical: 18, alignItems: 'center' },
  deleteButtonText: { fontSize: 17, color: '#ff3b30' },
});
