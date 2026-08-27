import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  deleteFeeding,
  getFeeding,
  insertFeeding,
  updateFeeding,
} from '@/db/feedings';
import { parseAmount } from '@/lib/amount';
import { formatDay, formatTimeOfDay } from '@/lib/time';

export default function FeedingFormScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const feedingId = id ? Number(id) : null;
  const isEditing = feedingId !== null;

  const [occurredAt, setOccurredAt] = useState(() => Date.now());
  const [amountText, setAmountText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [ready, setReady] = useState(!isEditing);

  useEffect(() => {
    if (feedingId === null) return;
    let alive = true;
    getFeeding(db, feedingId).then((row) => {
      if (!alive) return;
      if (!row) {
        Alert.alert('기록을 찾을 수 없습니다.');
        router.back();
        return;
      }
      setOccurredAt(row.occurred_at);
      setAmountText(row.amount_ml === null ? '' : String(row.amount_ml));
      setNoteText(row.note ?? '');
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [db, feedingId]);

  function onPickerChange(event: DateTimePickerEvent, selected?: Date) {
    const mode = picker;
    setPicker(null);
    if (event.type !== 'set' || !selected) return;

    const base = new Date(occurredAt);
    const next =
      mode === 'date'
        ? new Date(
            selected.getFullYear(),
            selected.getMonth(),
            selected.getDate(),
            base.getHours(),
            base.getMinutes()
          )
        : new Date(
            base.getFullYear(),
            base.getMonth(),
            base.getDate(),
            selected.getHours(),
            selected.getMinutes()
          );
    setOccurredAt(next.getTime());
  }

  async function onSave() {
    const amount = parseAmount(amountText);
    if (!amount.ok) {
      Alert.alert('입력을 확인해 주세요', amount.message);
      return;
    }
    // 미래 시각은 저장하지 않는다. 허용하면 "마지막 수유 -5분 전"이 나온다.
    // "지금"은 계속 바뀌므로 DB CHECK로는 표현할 수 없고 여기서 막아야 한다.
    if (occurredAt > Date.now()) {
      Alert.alert('입력을 확인해 주세요', '미래 시각은 기록할 수 없습니다.');
      return;
    }

    const note = noteText.trim();
    const input = {
      occurredAt,
      amountMl: amount.value,
      note: note === '' ? null : note,
    };

    if (feedingId === null) await insertFeeding(db, input);
    else await updateFeeding(db, feedingId, input);
    router.back();
  }

  function onDelete() {
    if (feedingId === null) return;
    Alert.alert('이 수유 기록을 삭제할까요?', '되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteFeeding(db, feedingId);
          router.back();
        },
      },
    ]);
  }

  if (!ready) return <View style={styles.container} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? '수유 기록 수정' : '수유 기록' }} />

      <Text style={styles.label}>수유 시각</Text>
      <View style={styles.row}>
        <Pressable style={styles.chip} onPress={() => setPicker('date')}>
          <Text style={styles.chipText}>{formatDay(occurredAt)}</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => setPicker('time')}>
          <Text style={styles.chipText}>{formatTimeOfDay(occurredAt)}</Text>
        </Pressable>
        <Pressable style={styles.nowChip} onPress={() => setOccurredAt(Date.now())}>
          <Text style={styles.nowChipText}>지금</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>수유량 (선택)</Text>
      <TextInput
        style={styles.input}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="number-pad"
        placeholder="모르면 비워 두세요"
        placeholderTextColor="#b0b0b5"
        returnKeyType="done"
        accessibilityLabel="수유량, 밀리리터, 선택 입력"
      />
      <Text style={styles.hint}>비워 두면 양을 기록하지 않은 수유로 저장됩니다.</Text>

      <Text style={styles.label}>메모 (선택)</Text>
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={noteText}
        onChangeText={setNoteText}
        placeholder="예: 트림 잘 함"
        placeholderTextColor="#b0b0b5"
        multiline
        accessibilityLabel="메모, 선택 입력"
      />

      <Pressable style={styles.saveButton} onPress={onSave} accessibilityRole="button">
        <Text style={styles.saveButtonText}>{isEditing ? '수정' : '저장'}</Text>
      </Pressable>

      {isEditing ? (
        <Pressable style={styles.deleteButton} onPress={onDelete} accessibilityRole="button">
          <Text style={styles.deleteButtonText}>삭제</Text>
        </Pressable>
      ) : null}

      {picker ? (
        <DateTimePicker
          value={new Date(occurredAt)}
          mode={picker}
          is24Hour
          maximumDate={picker === 'date' ? new Date() : undefined}
          onChange={onPickerChange}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 48, gap: 8 },
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
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e5',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#1c1c1e',
  },
  noteInput: { minHeight: 88, textAlignVertical: 'top' },
  hint: { fontSize: 13, color: '#8a8a8e' },
  saveButton: {
    marginTop: 32,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
  },
  saveButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  deleteButton: { marginTop: 8, paddingVertical: 18, alignItems: 'center' },
  deleteButtonText: { fontSize: 17, color: '#ff3b30' },
});
