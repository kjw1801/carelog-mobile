import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
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

import { deleteSleep, getSleep, updateSleep } from '@/db/sleeps';
import { showSuccessMessage } from '@/lib/feedback';
import { formatDay, formatDuration, formatTimeOfDay, mergePickedDateTime } from '@/lib/time';
import { type Colors } from '@/theme/colors';
import { useColors } from '@/theme/useColors';

type PickerTarget = { field: 'start' | 'end'; mode: 'date' | 'time' };

export default function SleepFormScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      showSuccessMessage('수면 기록을 수정했습니다');
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
          // `try`가 없으면 삭제가 실패했을 때 처리되지 않은 거부로 끝난다 —
          // `router.back()`도 안 돌아 화면이 그대로 남고 아무 말도 없다.
          try {
            // 목록이 낡아 이미 지워진 행을 다시 지우면 `false`다. 그때
            // "삭제했습니다"는 거짓말이므로 말하지 않는다.
            if (await deleteSleep(db, sleepId)) {
              showSuccessMessage('수면 기록을 삭제했습니다');
            }
            router.back();
          } catch {
            Alert.alert('삭제하지 못했습니다', '잠시 후 다시 시도해 주세요.');
          }
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
          placeholderTextColor={colors.textPlaceholder}
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
    </KeyboardAvoidingView>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    // 검증 기기에서 behavior="padding"만으로는 마지막 버튼의 스크롤 여유가
    // 부족했다. 키보드를 띄운 채 끝까지 내려도 버튼에 닿도록 여백을 둔다.
    content: { padding: 20, paddingBottom: 120, gap: 8 },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textLabel,
      marginTop: 16,
    },
    row: { flexDirection: 'row', gap: 8 },
    chip: {
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: c.surfaceMuted,
    },
    chipText: { fontSize: 17, color: c.text },
    activeChip: {
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: c.surfaceMuted,
    },
    activeChipText: { fontSize: 17, color: c.textMuted },
    nowChip: {
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: c.surfaceAccent,
    },
    nowChipText: { fontSize: 17, color: c.accentText, fontWeight: '600' },
    hint: { fontSize: 13, color: c.textMuted },
    noteInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 17,
      color: c.text,
      minHeight: 88,
      textAlignVertical: 'top',
    },
    saveButton: {
      marginTop: 32,
      paddingVertical: 18,
      borderRadius: 12,
      backgroundColor: c.accent,
      alignItems: 'center',
    },
    saveButtonDisabled: { backgroundColor: c.accentDisabled },
    saveButtonText: { fontSize: 17, fontWeight: '700', color: c.onAccent },
    deleteButton: { marginTop: 8, paddingVertical: 18, alignItems: 'center' },
    deleteButtonText: { fontSize: 17, color: c.danger },
  });
}
