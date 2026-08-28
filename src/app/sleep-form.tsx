import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { deleteSleep, getSleep, updateSleep } from '@/db/sleeps';
import {
  formatDay,
  formatDuration,
  formatTimeOfDay,
  mergePickedDateTime,
} from '@/lib/time';

type PickerTarget = { field: 'start' | 'end'; mode: 'date' | 'time' };

export default function SleepFormScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sleepId = Number(id);

  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  // setState는 다음 렌더에야 반영된다. 실제 잠금은 ref로 건다.
  // 이 화면은 기존 수면을 UPDATE만 하므로 중복 수정 요청과 화면 전환을 막는다.
  const savingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    getSleep(db, sleepId).then((row) => {
      if (!alive) return;
      if (!row) {
        Alert.alert('기록을 찾을 수 없습니다.');
        router.back();
        return;
      }
      setStartedAt(row.started_at);
      setEndedAt(row.ended_at);
      setNoteText(row.note ?? '');
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [db, sleepId]);

  function onPickerChange(_event: DateTimePickerChangeEvent, selected: Date) {
    const target = picker;
    setPicker(null);
    if (!target) return;

    if (target.field === 'start') {
      setStartedAt(mergePickedDateTime(startedAt, selected, target.mode));
    } else if (endedAt !== null) {
      setEndedAt(mergePickedDateTime(endedAt, selected, target.mode));
    }
  }

  async function onSave() {
    if (savingRef.current) return;
    if (startedAt > Date.now()) {
      Alert.alert('입력을 확인해 주세요', '미래 시각은 기록할 수 없습니다.');
      return;
    }
    if (endedAt !== null) {
      if (endedAt > Date.now()) {
        Alert.alert('입력을 확인해 주세요', '미래 시각은 기록할 수 없습니다.');
        return;
      }
      // DB의 CHECK와 같은 규칙을 여기서도 본다. 제약에 걸려 던지는 것보다
      // 무엇이 잘못됐는지 말해주는 편이 낫다.
      if (endedAt <= startedAt) {
        Alert.alert('입력을 확인해 주세요', '종료 시각은 시작 시각보다 뒤여야 합니다.');
        return;
      }
    }

    const note = noteText.trim();
    savingRef.current = true;
    setSaving(true);
    try {
      await updateSleep(db, sleepId, {
        startedAt,
        endedAt,
        note: note === '' ? null : note,
      });
      router.back();
    } catch {
      Alert.alert('저장하지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function onDelete() {
    if (savingRef.current) return;
    Alert.alert('이 수면 기록을 삭제할까요?', '되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteSleep(db, sleepId);
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
      <Stack.Screen options={{ title: '수면 기록 수정' }} />

      <Text style={styles.label}>시작 시각</Text>
      <View style={styles.row}>
        <Pressable
          style={styles.chip}
          onPress={() => setPicker({ field: 'start', mode: 'date' })}
          accessibilityRole="button"
          accessibilityLabel={`시작 날짜 ${formatDay(startedAt)}, 변경`}>
          <Text style={styles.chipText}>{formatDay(startedAt)}</Text>
        </Pressable>
        <Pressable
          style={styles.chip}
          onPress={() => setPicker({ field: 'start', mode: 'time' })}
          accessibilityRole="button"
          accessibilityLabel={`시작 시각 ${formatTimeOfDay(startedAt)}, 변경`}>
          <Text style={styles.chipText}>{formatTimeOfDay(startedAt)}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>종료 시각</Text>
      {endedAt === null ? (
        <View style={styles.row}>
          <View style={styles.activeChip}>
            <Text style={styles.activeChipText}>진행 중</Text>
          </View>
          <Pressable
            style={styles.nowChip}
            onPress={() => setEndedAt(Date.now())}
            accessibilityRole="button"
            accessibilityLabel="지금 시각으로 종료">
            <Text style={styles.nowChipText}>지금 종료</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable
            style={styles.chip}
            onPress={() => setPicker({ field: 'end', mode: 'date' })}
            accessibilityRole="button"
            accessibilityLabel={`종료 날짜 ${formatDay(endedAt)}, 변경`}>
            <Text style={styles.chipText}>{formatDay(endedAt)}</Text>
          </Pressable>
          <Pressable
            style={styles.chip}
            onPress={() => setPicker({ field: 'end', mode: 'time' })}
            accessibilityRole="button"
            accessibilityLabel={`종료 시각 ${formatTimeOfDay(endedAt)}, 변경`}>
            <Text style={styles.chipText}>{formatTimeOfDay(endedAt)}</Text>
          </Pressable>
        </View>
      )}

      {endedAt !== null && endedAt > startedAt ? (
        <Text style={styles.hint}>잔 시간 {formatDuration(endedAt - startedAt)}</Text>
      ) : null}

      <Text style={styles.label}>메모 (선택)</Text>
      <TextInput
        style={styles.noteInput}
        value={noteText}
        onChangeText={setNoteText}
        placeholder="예: 자다 깨서 뒤척임"
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
        <Text style={styles.saveButtonText}>수정</Text>
      </Pressable>

      <Pressable
        style={styles.deleteButton}
        onPress={onDelete}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}>
        <Text style={styles.deleteButtonText}>삭제</Text>
      </Pressable>

      {picker ? (
        <DateTimePicker
          value={new Date(picker.field === 'start' ? startedAt : (endedAt ?? startedAt))}
          mode={picker.mode}
          is24Hour
          maximumDate={picker.mode === 'date' ? new Date() : undefined}
          onValueChange={onPickerChange}
          onDismiss={() => setPicker(null)}
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
  activeChip: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#f0f0f3',
  },
  activeChipText: { fontSize: 17, color: '#8a8a8e' },
  nowChip: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#e5f0ff',
  },
  nowChipText: { fontSize: 17, color: '#0a84ff', fontWeight: '600' },
  hint: { fontSize: 13, color: '#8a8a8e' },
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
