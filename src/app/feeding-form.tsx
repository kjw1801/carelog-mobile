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
  BREAST_SIDE_LABEL,
  FEEDING_KIND_LABEL,
  deleteFeeding,
  getFeeding,
  insertFeeding,
  updateFeeding,
  type BreastSide,
  type NewFeedingKind,
  type StoredFeedingInput,
} from '@/db/feedings';
import { parseAmount } from '@/lib/amount';
import { formatDay, formatTimeOfDay, mergePickedDateTime } from '@/lib/time';

const KINDS: NewFeedingKind[] = ['breast', 'formula'];
const SIDES: BreastSide[] = ['left', 'right', 'both'];

export default function FeedingFormScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const feedingId = id ? Number(id) : null;
  const isEditing = feedingId !== null;

  const [occurredAt, setOccurredAt] = useState(() => Date.now());
  // 새 기록은 종류를 고르기 전까지 null이다. 기본값을 주면 고르지 않은 채
  // 저장돼 사실이 아닌 종류가 남는다.
  //
  // 기존 기록(unspecified)을 열면 여기도 null이다. 그대로 저장하면
  // unspecified가 유지되고, 모유·분유를 고르면 그때 전환된다.
  const [kind, setKind] = useState<NewFeedingKind | null>(null);
  const [wasUnspecified, setWasUnspecified] = useState(false);
  const [side, setSide] = useState<BreastSide | null>(null);
  const [amountText, setAmountText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [ready, setReady] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  // setState는 다음 렌더에야 반영된다. 실제 잠금은 ref로 건다.
  // insert는 UPSERT가 아니라, 연타하면 기록이 두 개 생긴다.
  const savingRef = useRef(false);

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
      setKind(row.kind === 'unspecified' ? null : row.kind);
      setWasUnspecified(row.kind === 'unspecified');
      setSide(row.side);
      setAmountText(row.amount_ml === null ? '' : String(row.amount_ml));
      setNoteText(row.note ?? '');
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [db, feedingId]);

  function onPickerChange(_event: DateTimePickerChangeEvent, selected: Date) {
    const mode = picker;
    setPicker(null);

    if (mode) setOccurredAt(mergePickedDateTime(occurredAt, selected, mode));
  }

  // 종류를 바꾸면 반대쪽 입력을 버린다. 남겨두면 모유인데 양이 붙거나
  // 분유인데 위치가 붙어 DB CHECK에 걸린다.
  function onPickKind(next: NewFeedingKind) {
    setKind(next);
    if (next === 'breast') setAmountText('');
    else setSide(null);
  }

  async function onSave() {
    if (savingRef.current) return;

    // 기존 기록은 종류를 고르지 않아도 저장할 수 있다. 새 기록은 못 한다 —
    // 고르지 않은 채 저장되면 unspecified가 새로 생겨난다.
    if (kind === null && !wasUnspecified) {
      Alert.alert('입력을 확인해 주세요', '수유 종류를 선택해 주세요.');
      return;
    }
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
    const base = { occurredAt, note: note === '' ? null : note };

    // 종류별로 반대쪽 열을 null로 못 박는다. 캐스트를 쓰지 않고 분기 안에서
    // 좁혀야 판별 유니온이 실제로 조합을 막는다.
    let stored: StoredFeedingInput;
    if (kind === 'breast') {
      if (side === null) {
        Alert.alert('입력을 확인해 주세요', '모유는 위치를 선택해 주세요.');
        return;
      }
      stored = { ...base, kind, side, amountMl: null };
    } else if (kind === 'formula') {
      stored = { ...base, kind, side: null, amountMl: amount.value };
    } else {
      stored = { ...base, kind: 'unspecified', side: null, amountMl: amount.value };
    }

    savingRef.current = true;
    setSaving(true);
    try {
      if (feedingId !== null) {
        await updateFeeding(db, feedingId, stored);
      } else if (stored.kind === 'unspecified') {
        // 새 기록은 위에서 종류를 강제하므로 여기에 오지 않는다. 캐스트 대신
        // 이 분기를 둬야 insertFeeding에 NewFeedingInput만 넘어가는 것이
        // 타입으로 보장된다.
        throw new Error('새 기록에는 수유 종류가 있어야 한다');
      } else {
        await insertFeeding(db, stored);
      }
      router.back();
    } catch {
      Alert.alert('저장하지 못했습니다', '잠시 후 다시 시도해 주세요.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function onDelete() {
    if (feedingId === null || savingRef.current) return;
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
    <KeyboardAvoidingView style={styles.container} behavior="padding">
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? '수유 기록 수정' : '수유 기록' }} />

      <Text style={styles.label}>수유 시각</Text>
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

      <Text style={styles.label}>수유 종류</Text>
      <View style={styles.row}>
        {KINDS.map((value) => {
          const selected = kind === value;
          return (
            <Pressable
              key={value}
              style={selected ? selectedChipStyle : styles.kindChip}
              onPress={() => onPickKind(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}>
              <Text style={selected ? selectedChipTextStyle : styles.kindText}>
                {FEEDING_KIND_LABEL[value]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {kind === null && wasUnspecified ? (
        <Text style={styles.hint}>
          기존 기록이라 수유 종류가 지정되지 않았습니다. 고르지 않고 저장해도 됩니다.
        </Text>
      ) : null}

      {kind === 'breast' ? (
        <>
          <Text style={styles.label}>위치</Text>
          <View style={styles.row}>
            {SIDES.map((value) => {
              const selected = side === value;
              return (
                <Pressable
                  key={value}
                  style={selected ? selectedChipStyle : styles.kindChip}
                  onPress={() => setSide(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}>
                  <Text style={selected ? selectedChipTextStyle : styles.kindText}>
                    {BREAST_SIDE_LABEL[value]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {/* 종류를 고르기 전에는 수유량을 받지 않는다. 먼저 적게 두면 모유를
          고르는 순간 그 값이 버려진다. 기존 기록은 이미 양이 있을 수 있어
          종류가 없어도 보여준다. */}
      {kind === 'formula' || (kind === null && wasUnspecified) ? (
        <>
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
        </>
      ) : null}

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
  kindChip: {
    flex: 1,
    backgroundColor: '#f2f2f7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  kindChipSelected: { backgroundColor: '#0a84ff' },
  kindText: { fontSize: 16, color: '#1c1c1e' },
  kindTextSelected: { color: '#fff', fontWeight: '700' },
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
  saveButtonDisabled: { backgroundColor: '#b0c9e5' },
  saveButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  deleteButton: { marginTop: 8, paddingVertical: 18, alignItems: 'center' },
  deleteButtonText: { fontSize: 17, color: '#ff3b30' },
});

const selectedChipStyle = StyleSheet.flatten([styles.kindChip, styles.kindChipSelected]);
const selectedChipTextStyle = StyleSheet.flatten([styles.kindText, styles.kindTextSelected]);
