import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useFocusEffect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getBaby, type Baby } from '@/db/baby';
import { getTodayDiaperCount } from '@/db/diapers';
import {
  getLastFeeding,
  getTodaySummary,
  type Feeding,
  type TodaySummary,
} from '@/db/feedings';
import {
  endSleep,
  getActiveSleep,
  listSleepsOverlapping,
  startSleep,
  type Sleep,
} from '@/db/sleeps';
import { calculateSleepDuration } from '@/lib/sleep';
import {
  formatDuration,
  formatDurationCompact,
  formatElapsed,
  formatTimeOfDay,
  todayRange,
} from '@/lib/time';

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

export default function TodayScreen() {
  const db = useSQLiteContext();
  const [last, setLast] = useState<Feeding | null>(null);
  const [summary, setSummary] = useState<TodaySummary>({ count: 0, amountMl: null });
  const [diaperCount, setDiaperCount] = useState(0);
  const [todaySleeps, setTodaySleeps] = useState<Sleep[]>([]);
  const [baby, setBaby] = useState<Baby | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toggling, setToggling] = useState(false);
  // setState는 다음 렌더에야 반영되므로 연타를 막지 못한다. 실제 잠금은 ref로 걸고,
  // state는 버튼 비활성화 표시에만 쓴다.
  const togglingRef = useRef(false);

  // 오늘의 시작을 now에서 파생시킨다. 하루 안에서는 같은 숫자라 아래 조회가
  // 매분 다시 돌지 않고, 자정을 넘기면 값이 바뀌어 다시 조회된다.
  const dayStart = todayRange(new Date(now)).start;

  // 진행 중인 수면은 정의상 항상 오늘과 겹치므로 목록에서 파생한다.
  // 별도 상태로 들면 두 값이 어긋날 수 있다.
  const activeSleep = todaySleeps.find((s) => s.ended_at === null) ?? null;

  // 합계는 now가 바뀔 때마다 다시 계산한다. 조회 시점에 숫자로 접어두면 진행 중인
  // 수면의 기여분이 얼어붙는다. 1분 타이머가 now를 갱신하므로 DB는 매분 조회하지 않는다.
  //
  // useMemo를 빼면 React Compiler가 이 컴포넌트의 최적화를 포기한다
  // (ESLint react-hooks/preserve-manual-memoization). 지우지 말 것.
  const sleepMs = useMemo(
    () =>
      calculateSleepDuration(
        todaySleeps,
        dayStart,
        todayRange(new Date(dayStart)).end,
        now
      ),
    [todaySleeps, dayStart, now]
  );

  // 조회와 반영은 분리해 둔다. 한 함수에서 setState까지 하면 호출부의
  // alive 검사가 이미 늦어 아무것도 막지 못한다.
  const fetchAll = useCallback(async () => {
    const { start, end } = todayRange(new Date(dayStart));
    const [lastRow, todayRow, diapers, sleeps, babyRow] = await Promise.all([
      getLastFeeding(db),
      getTodaySummary(db, start, end),
      getTodayDiaperCount(db, start, end),
      listSleepsOverlapping(db, start, end),
      getBaby(db),
    ]);
    return { lastRow, todayRow, diapers, sleeps, babyRow };
  }, [db, dayStart]);

  const apply = useCallback((data: Awaited<ReturnType<typeof fetchAll>>) => {
    setLast(data.lastRow);
    setSummary(data.todayRow);
    setDiaperCount(data.diapers);
    setTodaySleeps(data.sleeps);
    setBaby(data.babyRow);
  }, []);

  // 저장·수정·삭제 후 모달이 닫히면 이 화면이 포커스를 받는다. 그때 다시 조회한다.
  // dayStart가 바뀔 때도 다시 조회한다 — 화면을 켜둔 채, 또는 앱을 백그라운드에
  // 둔 채 자정을 넘기면 포커스가 바뀌지 않아 어제 집계가 그대로 남는다.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      // 조회에 실패하면 화면을 그대로 둔다. 다음 포커스나 날짜 변경 때 다시 읽는다.
      fetchAll()
        .then((data) => {
          if (alive) apply(data);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [fetchAll, apply])
  );

  // 경과 시간은 1분마다, 그리고 앱이 foreground로 돌아올 때 갱신한다.
  // 갱신할 때 DB를 다시 읽지는 않는다 — 기준 시각은 그대로고 현재 시각만 변한다.
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

  async function onToggleSleep() {
    if (togglingRef.current) return;
    togglingRef.current = true;
    setToggling(true);
    try {
      if (activeSleep) {
        try {
          const ended = await endSleep(db, activeSleep.id, Date.now());
          // 진행 중인 행만 UPDATE되므로, 낡은 상태로 눌렀으면 아무것도 안 바뀐다.
          if (!ended) Alert.alert('이미 종료된 수면입니다');
        } catch {
          Alert.alert('수면을 종료하지 못했습니다', '잠시 후 다시 시도해 주세요.');
          return;
        }
      } else {
        try {
          await startSleep(db, Date.now());
        } catch {
          // 유니크 인덱스가 진행 중 수면을 하나로 막으므로 중복 시작이 여기로 온다.
          // 잠김·연결 오류도 같은 자리로 오니, 실제 진행 중 기록이 있을 때만
          // 중복이라고 말한다.
          const existing = await getActiveSleep(db).catch(() => null);
          if (existing) {
            // 화면이 낡아서 눌린 것이다. 여기서 return하면 계속 '수면 시작'으로
            // 남아 누를 때마다 같은 오류만 반복된다.
            //
            // 아래 재조회로 맞추되, 그것마저 실패해도 버튼이 멈추지 않도록
            // 찾은 행을 먼저 넣는다. 목록을 통째로 갈아치우면 오늘 끝난 수면이
            // 빠져 합계가 잠깐 줄어들므로 병합한다.
            setTodaySleeps((prev) =>
              prev.some((row) => row.id === existing.id) ? prev : [...prev, existing]
            );
            Alert.alert('이미 진행 중인 수면이 있습니다', '먼저 종료해 주세요.');
          } else {
            Alert.alert('수면을 시작하지 못했습니다', '잠시 후 다시 시도해 주세요.');
            return;
          }
        }
      }
      // 성공했든 중복이었든 화면을 다시 맞춘다. 갱신 실패는 알리지 않는다 —
      // 다음 포커스나 날짜 변경 때 다시 읽는다.
      const data = await fetchAll().catch(() => null);
      if (data) apply(data);
    } finally {
      togglingRef.current = false;
      setToggling(false);
    }
  }

  // 진행 중 수면은 실수로 눌러도 즉시 종료되지 않도록 한 번 확인한다.
  // 시작은 잘못 눌러도 바로 다시 눌러 되돌릴 수 있으므로 묻지 않는다.
  function onPressSleep() {
    if (togglingRef.current) return;
    if (!activeSleep) {
      void onToggleSleep();
      return;
    }
    Alert.alert('수면을 종료할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '종료', onPress: () => void onToggleSleep() },
    ]);
  }

  const elapsedSleep = activeSleep ? formatDuration(now - activeSleep.started_at) : null;
  const sleepOverdue = activeSleep ? now - activeSleep.started_at >= TWELVE_HOURS : false;

  // 라벨을 붙이면 자식 Text가 낭독에서 빠진다. 12시간 초과는 화면에서 색으로만
  // 알리므로 낭독에는 말로 넣는다 — 색은 읽히지 않는다.
  const sleepAccessibilityLabel = activeSleep
    ? [
        '수면 중',
        elapsedSleep,
        sleepOverdue ? '12시간 초과' : null,
        '탭하여 종료 확인',
      ]
        .filter(Boolean)
        .join(', ')
    : '수면 시작';

  // 탭 라벨은 `오늘`로 두고 헤더 제목만 바꾼다. `title`은 둘 다 바꾼다.
  // setOptions가 매 렌더 새 객체를 받으면 불필요한 재설정이 생긴다.
  const babyName = baby?.name;
  const screenOptions = useMemo(
    () => ({ headerTitle: babyName ? `${babyName}의 오늘` : '오늘' }),
    [babyName],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Tabs.Screen options={screenOptions} />

      <ScrollView style={styles.cards} contentContainerStyle={styles.cardsContent}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>마지막 수유</Text>
          {last ? (
            <>
              <Text style={styles.cardValue} numberOfLines={1}>{formatElapsed(last.occurred_at, now)}</Text>
              <Text style={styles.cardSub}>{formatTimeOfDay(last.occurred_at)}</Text>
            </>
          ) : (
            <Text style={styles.cardEmpty}>기록 없음</Text>
          )}
        </View>

        <View style={styles.cardRow}>
          <View style={cardHalfStyle}>
            <Text style={styles.cardLabel}>오늘 수유</Text>
            <Text style={styles.cardValue} numberOfLines={1}>{summary.count}회</Text>
          </View>
          <View style={cardHalfStyle}>
            <Text style={styles.cardLabel}>오늘 기저귀</Text>
            <Text style={styles.cardValue} numberOfLines={1}>{diaperCount}회</Text>
          </View>
        </View>

        <View style={styles.cardRow}>
          {/* 겹치는 수면이 하나도 없으면 0시간이 아니라 "기록 없음"이다.
              안 잔 것과 기록하지 않은 것은 다르다. */}
          <View style={cardHalfStyle}>
            <Text style={styles.cardLabel}>오늘 수면</Text>
            {todaySleeps.length === 0 ? (
              <Text style={styles.cardEmpty}>기록 없음</Text>
            ) : (
              <Text style={styles.cardValue} numberOfLines={1}>{formatDurationCompact(sleepMs)}</Text>
            )}
          </View>
          {/* 오늘 수유량을 한 번도 입력하지 않았다면 0ml이 아니라 "기록 없음"이다. */}
          <View style={cardHalfStyle}>
            <Text style={styles.cardLabel}>입력된 수유량</Text>
            {summary.amountMl === null ? (
              <Text style={styles.cardEmpty}>기록 없음</Text>
            ) : (
              <Text style={styles.cardValue} numberOfLines={1}>{summary.amountMl}ml</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttons}>
        <Link href="/feeding-form" asChild>
          <Pressable style={feedingButtonStyle} accessibilityRole="button">
            <Text style={styles.addButtonText}>수유 기록</Text>
          </Pressable>
        </Link>
        <Link href="/diaper-form" asChild>
          <Pressable style={diaperButtonStyle} accessibilityRole="button">
            <Text style={styles.addButtonText}>기저귀 기록</Text>
          </Pressable>
        </Link>
      </View>

      <Pressable
        style={sleepButtonStyle(activeSleep !== null, sleepOverdue)}
        onPress={onPressSleep}
        disabled={toggling}
        accessibilityRole="button"
        accessibilityState={{ disabled: toggling }}
        accessibilityLabel={sleepAccessibilityLabel}>
        <View style={styles.sleepMain}>
          {/* 달이 아니라 침대다. 신생아는 낮잠·밤잠을 가리지 않고 자므로
              달은 사실과 다르다. V1은 수면 구간 하나만 기록한다. */}
          <Ionicons name="bed" size={18} color={activeSleep ? '#fff' : '#c7c6d4'} />
          <Text style={styles.addButtonText}>
            {activeSleep ? `수면 중 · ${elapsedSleep}` : '수면 시작'}
          </Text>
        </View>
        {/* 시작 시각과 12시간 안내 문구는 넣지 않는다. 여기서 알아야 할 것은
            자는 중인지, 얼마나 됐는지, 어디를 눌러 끝내는지뿐이다.
            시작 시각은 기록 탭에 있고, 12시간 초과는 글자 색으로 알린다. */}
        {activeSleep ? <Text style={styles.sleepEnd}>수면 종료</Text> : null}
      </Pressable>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7', padding: 20, gap: 12 },
  // 카드는 스크롤한다. 고정 높이 컬럼은 항목이 늘면 버튼 뒤로 잘린다.
  cards: { flex: 1 },
  // 끝까지 내렸을 때 마지막 카드가 경계에 붙지 않도록 여백을 준다.
  cardsContent: { gap: 12, paddingBottom: 12 },
  cardRow: { flexDirection: 'row', gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 4 },
  cardHalf: { flex: 1 },
  cardLabel: { fontSize: 14, color: '#8a8a8e' },
  cardValue: { fontSize: 32, fontWeight: '700', color: '#1c1c1e' },
  cardSub: { fontSize: 15, color: '#8a8a8e' },
  cardEmpty: { fontSize: 20, color: '#b0b0b5', paddingVertical: 6 },
  buttons: { flexDirection: 'row', gap: 12 },
  // flex는 가로 행 버튼에만. 세로 컨테이너의 직계 자식에 주면 남는 높이를
  // 전부 먹어 다른 카드를 덮는다.
  addButton: {
    backgroundColor: '#0a84ff',
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
  },
  inRow: { flex: 1 },
  diaperButton: { backgroundColor: '#34a853' },
  // 버튼 전체 색이 바뀌어야 상태가 바뀐 것으로 읽힌다. 아이콘과 글자만
  // 바꾸면 눌렀는지 아닌지 알기 어렵다.
  //
  // 밝은 주황(#ff9500)은 밤중에 눈부시고 흰 글자 대비가 2.2:1로 큰 글자
  // 기준(3:1)에도 못 미쳤다. 차분한 톤으로 낮춰 대비를 얻는다 —
  // #b85c00은 4.60:1, #9f3a20은 6.77:1이다.
  //
  // 12시간을 넘기면 한 단계 더 진한 색으로 간다. 주황 위에 노란 글씨를 얹으면
  // 대비가 나빠 안내가 묻힌다.
  sleepStartButton: { backgroundColor: '#3f3d56' },
  sleepActiveButton: { backgroundColor: '#b85c00' },
  sleepOverdueButton: { backgroundColor: '#9f3a20' },
  // 수면 컨트롤은 위 두 버튼과 같은 addButton을 쓴다. 한 줄에 같은 글자 크기라
  // 높이가 따로 지정하지 않아도 같아진다. 숫자로 박으면 글자 크기를 키운
  // 기기에서 어긋난다.
  // flexDirection이 row가 되면 alignItems는 세로만 맡는다. 가로 가운데는
  // justifyContent가 한다. 진행 중 상태는 아래 space-between이 덮어쓴다.
  sleepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  sleepRowActive: { justifyContent: 'space-between', paddingHorizontal: 20 },
  sleepMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sleepEnd: { fontSize: 15, fontWeight: '700', color: '#fff' },
  addButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
});

// <Link asChild>는 자식에게 스타일 배열을 넘기면 expo-router가 throw한다.
// 한 번만 합쳐서 단일 객체로 전달한다.
const feedingButtonStyle = StyleSheet.flatten([styles.addButton, styles.inRow]);
const diaperButtonStyle = StyleSheet.flatten([
  styles.addButton,
  styles.inRow,
  styles.diaperButton,
]);
const sleepStartButtonStyle = StyleSheet.flatten([
  styles.addButton,
  styles.sleepStartButton,
  styles.sleepRow,
]);
const sleepActiveStyle = StyleSheet.flatten([
  styles.addButton,
  styles.sleepActiveButton,
  styles.sleepRow,
  styles.sleepRowActive,
]);
const sleepOverdueStyle = StyleSheet.flatten([
  styles.addButton,
  styles.sleepOverdueButton,
  styles.sleepRow,
  styles.sleepRowActive,
]);

function sleepButtonStyle(active: boolean, overdue: boolean) {
  if (!active) return sleepStartButtonStyle;
  return overdue ? sleepOverdueStyle : sleepActiveStyle;
}
const cardHalfStyle = StyleSheet.flatten([styles.card, styles.cardHalf]);
