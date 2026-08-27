import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTodayDiaperCount } from '@/db/diapers';
import {
  getLastFeeding,
  getTodaySummary,
  type Feeding,
  type TodaySummary,
} from '@/db/feedings';
import { formatElapsed, formatTimeOfDay, todayRange } from '@/lib/time';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const [last, setLast] = useState<Feeding | null>(null);
  const [summary, setSummary] = useState<TodaySummary>({ count: 0, amountMl: null });
  const [diaperCount, setDiaperCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // 오늘의 시작을 now에서 파생시킨다. 하루 안에서는 같은 숫자라 아래 조회가
  // 매분 다시 돌지 않고, 자정을 넘기면 값이 바뀌어 다시 조회된다.
  const dayStart = todayRange(new Date(now)).start;

  // 저장·수정·삭제 후 모달이 닫히면 이 화면이 포커스를 받는다. 그때 다시 조회한다.
  // dayStart가 바뀔 때도 다시 조회한다 — 화면을 켜둔 채, 또는 앱을 백그라운드에
  // 둔 채 자정을 넘기면 포커스가 바뀌지 않아 어제 집계가 그대로 남는다.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const { start, end } = todayRange(new Date(dayStart));
      Promise.all([
        getLastFeeding(db),
        getTodaySummary(db, start, end),
        getTodayDiaperCount(db, start, end),
      ]).then(([lastRow, todayRow, diapers]) => {
        if (!alive) return;
        setLast(lastRow);
        setSummary(todayRow);
        setDiaperCount(diapers);
      });
      return () => {
        alive = false;
      };
    }, [db, dayStart])
  );

  // 경과 시간은 1분마다, 그리고 앱이 foreground로 돌아올 때 갱신한다.
  // 갱신할 때 DB를 다시 읽지는 않는다 — 마지막 수유 시각은 그대로고 현재 시각만 변한다.
  // 단 이 갱신으로 날짜가 넘어가면 위 dayStart가 바뀌면서 집계는 다시 조회된다.
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const timer = setInterval(() => setNow(Date.now()), 60_000);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') setNow(Date.now());
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>마지막 수유</Text>
          {last ? (
            <>
              <Text style={styles.cardValue}>{formatElapsed(last.occurred_at, now)}</Text>
              <Text style={styles.cardSub}>{formatTimeOfDay(last.occurred_at)}</Text>
            </>
          ) : (
            <Text style={styles.cardEmpty}>기록 없음</Text>
          )}
        </View>

        <View style={styles.cardRow}>
          <View style={[styles.card, styles.cardHalf]}>
            <Text style={styles.cardLabel}>오늘 수유</Text>
            <Text style={styles.cardValue}>{summary.count}회</Text>
          </View>
          <View style={[styles.card, styles.cardHalf]}>
            <Text style={styles.cardLabel}>오늘 기저귀</Text>
            <Text style={styles.cardValue}>{diaperCount}회</Text>
          </View>
        </View>

        {/* 오늘 수유량을 한 번도 입력하지 않았다면 0ml이 아니라 "기록 없음"이다. */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>입력된 수유량</Text>
          {summary.amountMl === null ? (
            <Text style={styles.cardEmpty}>기록 없음</Text>
          ) : (
            <Text style={styles.cardValue}>{summary.amountMl}ml</Text>
          )}
        </View>
      </View>

      <View style={styles.buttons}>
        <Link href="/feeding-form" asChild>
          <Pressable style={styles.addButton} accessibilityRole="button">
            <Text style={styles.addButtonText}>수유 기록</Text>
          </Pressable>
        </Link>
        <Link href="/diaper-form" asChild>
          <Pressable style={diaperButtonStyle} accessibilityRole="button">
            <Text style={styles.addButtonText}>기저귀 기록</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7', padding: 20, gap: 16 },
  cards: { flex: 1, gap: 12 },
  cardRow: { flexDirection: 'row', gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, gap: 4 },
  cardHalf: { flex: 1 },
  cardLabel: { fontSize: 14, color: '#8a8a8e' },
  cardValue: { fontSize: 32, fontWeight: '700', color: '#1c1c1e' },
  cardSub: { fontSize: 15, color: '#8a8a8e' },
  cardEmpty: { fontSize: 20, color: '#b0b0b5', paddingVertical: 6 },
  buttons: { flexDirection: 'row', gap: 12 },
  addButton: {
    flex: 1,
    backgroundColor: '#0a84ff',
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
  },
  diaperButton: { backgroundColor: '#34a853' },
  addButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
});

// <Link asChild>는 자식에게 스타일 배열을 넘기면 expo-router가 throw한다.
// 한 번만 합쳐서 단일 객체로 전달한다.
const diaperButtonStyle = StyleSheet.flatten([styles.addButton, styles.diaperButton]);
