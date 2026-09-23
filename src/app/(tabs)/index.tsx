import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { HeaderTitle, type HeaderTitleProps } from 'expo-router/react-navigation';
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
  type TextProps,
} from 'react-native';

import { getBaby, type Baby } from '@/db/baby';
import {
  DIAPER_KINDS,
  DIAPER_KIND_LABEL,
  getDiaperCount,
  insertDiaper,
  type DiaperKind,
} from '@/db/diapers';
import {
  BREAST_SIDE_LABEL,
  feedingDetail,
  getLastFeeding,
  insertFeeding,
  getFeedingSummary,
  todayFeedingLine,
  type BreastSide,
  type Feeding,
  type FeedingSummary,
} from '@/db/feedings';
import {
  endSleep,
  getActiveSleep,
  listSleepsOverlapping,
  startSleep,
  type Sleep,
} from '@/db/sleeps';
import { daysSinceBirth } from '@/lib/date';
import { showSuccessMessage } from '@/lib/feedback';
import { clampName } from '@/lib/name';
import { calculateSleepDuration } from '@/lib/sleep';
import { type Colors } from '@/theme/colors';
import { useColors } from '@/theme/useColors';
import {
  formatDuration,
  formatDurationCompact,
  formatElapsed,
  formatTimeOfDay,
  todayRange,
} from '@/lib/time';

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

const BREAST_SIDES: BreastSide[] = ['left', 'right', 'both'];

/**
 * 하단 빠른 기록 전용 글자. **시스템 글꼴 배율을 따르지 않는다.**
 *
 * 이 영역은 높이가 고정돼야 한다. 글꼴을 키우면 버튼 세 줄이 같이 커지면서 위
 * 카드 영역을 밀어내는데, 카드가 `flex: 1`이라 밀린 만큼 잘린다. 1.5배에서
 * `오늘 수면`·`오늘 기저귀`가 윗변만 남았다.
 *
 * 읽는 화면은 그대로 둔다 — 상단 카드, 기록 목록, 통계, 설정, 입력 폼은 계속
 * 시스템 배율을 따른다. 한 손으로 누르는 곳만 고정한다.
 */
function FixedText(props: TextProps) {
  return <Text {...props} allowFontScaling={false} />;
}

export default function TodayScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const db = useSQLiteContext();
  const [last, setLast] = useState<Feeding | null>(null);
  const [summary, setSummary] = useState<FeedingSummary>({
    count: 0,
    breastCount: 0,
    formulaCount: 0,
    formulaMl: null,
  });
  const [diaperCount, setDiaperCount] = useState(0);
  const [todaySleeps, setTodaySleeps] = useState<Sleep[]>([]);
  const [baby, setBaby] = useState<Baby | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toggling, setToggling] = useState(false);
  // 수유와 기저귀가 같은 잠금을 쓴다. 한 번에 한 건만 저장한다.
  const [savingRecord, setSavingRecord] = useState(false);
  const savingRecordRef = useRef(false);
  // 화면이 직접 올린 숫자를 **그 전에 시작된** 조회가 덮지 않게 한다. 조회는
  // 시작 시점의 DB를 읽으므로, 늦게 도착한 옛 결과가 방금 더한 1을 지운다.
  // 쓰기마다 올리고, 조회는 시작할 때의 값과 달라졌으면 결과를 버린다.
  const writeSeq = useRef(0);
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
    () => calculateSleepDuration(todaySleeps, dayStart, todayRange(new Date(dayStart)).end, now),
    [todaySleeps, dayStart, now]
  );

  // 조회와 반영은 분리해 둔다. 한 함수에서 setState까지 하면 호출부의
  // alive 검사가 이미 늦어 아무것도 막지 못한다.
  const fetchAll = useCallback(async () => {
    const { start, end } = todayRange(new Date(dayStart));
    const [lastRow, todayRow, diapers, sleeps, babyRow] = await Promise.all([
      getLastFeeding(db),
      getFeedingSummary(db, start, end),
      getDiaperCount(db, start, end),
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
      const seq = writeSeq.current;
      // 조회에 실패하면 화면을 그대로 둔다. 다음 포커스나 날짜 변경 때 다시 읽는다.
      fetchAll()
        .then((data) => {
          if (alive && seq === writeSeq.current) apply(data);
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

  /**
   * 기저귀 원터치 저장. 화면 전환 없이 지금 시각으로 한 건을 남긴다.
   *
   * 저장 결과를 Toast로 말해준다. `오늘 기저귀` 숫자만으로는 부족하다 —
   * 손가락과 눈이 화면 아래에 있고, 재조회가 실패해도 조용히 지나간다.
   * Toast는 재조회 성공 여부와 무관하게 "행이 생겼다"는 사실만 전한다.
   */
  //
  // `useCallback`을 벗기지 말 것. 일반 함수 선언으로 두면 React Compiler의
  // purity 검사가 아래 `Date.now()`를 "렌더 중 호출"이라며 막는다. **인자를 받는**
  // 핸들러에서만 나는 오탐이다 — 같은 본문에서 인자만 없애면 통과한다.
  const onQuickDiaper = useCallback(
    async (kind: DiaperKind) => {
      if (savingRecordRef.current) return;
      savingRecordRef.current = true;
      setSavingRecord(true);
      try {
        // 한 번만 읽는다. 저장과 피드백이 다른 분을 가리키면 안 된다.
        const at = Date.now();
        await insertDiaper(db, { occurredAt: at, kind, note: null });
        writeSeq.current += 1;
        // 자정을 넘긴 채 눌렀으면 화면의 오늘이 어제다. 낡은 숫자에 더하지 않고
        // now를 밀어 dayStart를 바꾼다. 그러면 위 조회가 알아서 다시 돈다.
        const sameDay = todayRange(new Date(at)).start === dayStart;
        if (sameDay) setDiaperCount((count) => count + 1);
        else setNow(at);
        showSuccessMessage(`${DIAPER_KIND_LABEL[kind]}으로 기록했습니다`);
      } catch {
        Alert.alert('기저귀를 기록하지 못했습니다', '잠시 후 다시 시도해 주세요.');
      } finally {
        savingRecordRef.current = false;
        setSavingRecord(false);
      }
    },
    [db, dayStart]
  );

  /**
   * 모유 빠른 저장. 위치만 고르면 지금 시각으로 한 건을 남긴다.
   *
   * 분유는 여기 없다. 양이 선택 입력이라 원터치를 열어두면 `amount_ml`이 빈
   * 기록이 쌓이고, 그러면 `분유 2회 · 120ml`가 두 번의 총량처럼 읽힌다. 기록된
   * 총량의 완결성이 떨어져 `오늘 분유량`과 통계 막대를 믿기 어려워진다.
   */
  const onQuickFeeding = useCallback(
    async (side: BreastSide) => {
      if (savingRecordRef.current) return;
      savingRecordRef.current = true;
      setSavingRecord(true);
      try {
        const at = Date.now();
        await insertFeeding(db, {
          occurredAt: at,
          kind: 'breast',
          side,
          amountMl: null,
          note: null,
        });
        writeSeq.current += 1;
        showSuccessMessage(`모유 ${BREAST_SIDE_LABEL[side]}으로 기록했습니다`);

        // 자정을 넘긴 채 눌렀으면 화면의 오늘이 어제다. 여기서 `fetchAll`을 부르면
        // **이 렌더가 잡고 있는 낡은 `dayStart`**로 어제 범위를 조회해 어제 집계를
        // 한 번 덧씌운다. 조회하지 말고 now만 밀어 `dayStart`를 바꾼다 —
        // 그러면 위 포커스 이펙트가 새 날짜로 다시 조회한다.
        if (todayRange(new Date(at)).start !== dayStart) {
          setNow(at);
          return;
        }

        // 기저귀와 달리 낙관적으로 숫자를 올리지 않는다. 바뀌는 것이 `오늘 모유
        // N회`만이 아니라 `마지막 수유` 줄 전체라 한 번에 다시 읽는 편이 맞다.
        //
        // **기다리지 않는다.** `await`하면 그동안 버튼이 잠겨 다음 한 건을 못 누른다.
        // 저장됐다는 사실은 이미 Toast가 알렸고, 낡은 결과는 `writeSeq`가 막는다.
        const seq = writeSeq.current;
        void fetchAll()
          .then((data) => {
            if (seq === writeSeq.current) apply(data);
          })
          .catch(() => {});
      } catch {
        Alert.alert('수유를 기록하지 못했습니다', '잠시 후 다시 시도해 주세요.');
      } finally {
        savingRecordRef.current = false;
        setSavingRecord(false);
      }
    },
    [db, dayStart, fetchAll, apply]
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
          // 그때는 순번을 올리지 않는다 — 바뀐 게 없고, 낡은 화면을 고칠 조회를
          // 오히려 버리게 된다.
          if (ended) {
            writeSeq.current += 1;
            showSuccessMessage('수면을 종료했습니다');
          } else {
            Alert.alert('이미 종료된 수면입니다');
          }
        } catch {
          Alert.alert('수면을 종료하지 못했습니다', '잠시 후 다시 시도해 주세요.');
          return;
        }
      } else {
        try {
          await startSleep(db, Date.now());
          writeSeq.current += 1;
          showSuccessMessage('수면을 시작했습니다');
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
            // 이것도 화면이 DB보다 앞서는 쓰기다. 먼저 출발한 조회가 덮으면
            // 진행 중 수면이 사라져 버튼이 다시 `수면 시작`으로 돌아간다.
            writeSeq.current += 1;
            Alert.alert('이미 진행 중인 수면이 있습니다', '먼저 종료해 주세요.');
          } else {
            Alert.alert('수면을 시작하지 못했습니다', '잠시 후 다시 시도해 주세요.');
            return;
          }
        }
      }
      // 성공했든 중복이었든 화면을 다시 맞춘다. 갱신 실패는 알리지 않는다 —
      // 다음 포커스나 날짜 변경 때 다시 읽는다.
      const seq = writeSeq.current;
      const data = await fetchAll().catch(() => null);
      if (data && seq === writeSeq.current) apply(data);
    } finally {
      togglingRef.current = false;
      setToggling(false);
    }
  }

  // 확인창을 두지 않는다. 전에는 전폭 버튼이라 아무 데나 스쳐도 종료됐지만,
  // 이제 누를 수 있는 곳이 오른쪽 80dp뿐이라 실수로 닿기 어렵다. 잘못 눌렀으면
  // 기록 탭에서 종료 시각을 고치거나 지우면 된다.
  function onPressSleep() {
    if (togglingRef.current) return;
    void onToggleSleep();
  }

  const lastDetail = last
    ? `${formatTimeOfDay(last.occurred_at)} · ${feedingDetail(last.kind, last.side, last.amount_ml)}`
    : null;
  const todayLine = todayFeedingLine(summary);

  // 카드를 하나의 접근성 노드로 묶는다. 묶지 않으면 조각이 넷으로 읽힌다.
  // 가운뎃점은 화면에서 조각을 나누려고 쓴 기호다. 낭독에서는 쉼표가 맞다.
  const feedingLabel = last
    ? ['마지막 수유', formatElapsed(last.occurred_at, now), lastDetail, todayLine]
        .join(', ')
        .split(' · ')
        .join(', ')
    : '마지막 수유, 기록 없음';

  const elapsedSleep = activeSleep ? formatDuration(now - activeSleep.started_at) : null;

  const sleepOverdue = activeSleep ? now - activeSleep.started_at >= TWELVE_HOURS : false;

  // 한 줄로 적는다. 상태가 바뀐 것은 오른쪽 버튼 색과 글자(`시작`/`종료`)가
  // 이미 말한다.
  const sleepLine = !activeSleep
    ? '수면'
    : `${sleepOverdue ? '12시간 초과' : '수면 중'} · ${elapsedSleep}`;

  // 12시간 초과는 화면에서 색으로만 알리므로 낭독에는 말로 넣는다 — 색은 읽히지
  // 않는다. 상태만 읽고, 무엇을 누를지는 옆 버튼이 스스로 말한다.
  const sleepStatusLabel = activeSleep
    ? ['수면 중', elapsedSleep, sleepOverdue ? '12시간 초과' : null].filter(Boolean).join(', ')
    : '진행 중인 수면 없음';

  // 탭 라벨은 `오늘`로 두고 헤더 제목만 바꾼다. `title`은 둘 다 바꾼다.
  // setOptions가 매 렌더 새 객체를 받으면 불필요한 재설정이 생긴다.
  // 원본과 표시용을 나눠 든다. 제한을 넣기 전에 저장된 긴 이름이 남아 있을 수
  // 있어 **그릴 때만** 자른다. 저장된 값은 건드리지 않는다.
  // 낭독은 잘린 쪽이 아니라 원본을 읽어야 한다 — 화면이 좁아서 줄인 것이지
  // 이름이 그것인 게 아니다.
  const fullBabyName = baby?.name ?? null;
  const displayBabyName = fullBabyName ? clampName(fullBabyName) : null;
  const birthDate = baby?.birth_date;
  // `now`가 아니라 여기서 나온 **일수**를 의존성에 둔다. now는 1분마다 바뀌지만
  // 이 값은 자정에만 바뀌므로, 헤더가 매분 다시 설정되지 않는다.
  const dayCount = birthDate ? daysSinceBirth(birthDate, new Date(now)) : null;

  // 제목을 문자열 하나로 넘기면 자리가 모자랄 때 **뒤에서부터** 잘린다. 뒤에
  // 있는 `D+n`이 먼저 사라지는데, 그게 이 헤더에서 유일하게 새로 보려던 값이다.
  // 이름 길이를 줄여도 작은 화면·큰 글꼴·`D+1000`에서 다시 같은 일이 생긴다.
  //
  // 그래서 두 조각으로 나눠 **이름만 줄어들게** 한다. 뒤쪽은 `flexShrink: 0`이라
  // 접미부 자체가 들어갈 수 있는 폭이면 온전히 남고, 넘치는 건 이름이 말줄임으로
  // 흡수한다. 기본 타이포를 그대로 쓰려고 헤더의 `HeaderTitle`을 그대로 쓴다.
  const screenOptions = useMemo(() => {
    const suffix = dayCount === null ? '' : ` · D+${dayCount}`;
    if (!displayBabyName || !fullBabyName) {
      return { headerTitle: `오늘${suffix}` };
    }
    return {
      headerTitle: ({ onLayout, style, ...titleProps }: HeaderTitleProps) => (
        // `onLayout`은 헤더가 **제목 전체의 폭**을 재려고 넘기는 것이다. 두
        // 조각에 각각 주면 두 번 불려 마지막 조각의 폭으로 덮인다. 바깥에서
        // 한 번만 잰다. `style`도 헤더가 주는 값이라 버리지 않고 앞에 깐다.
        //
        // 조각을 나눈 건 폭을 다루려는 것이지 제목을 둘로 만들려는 게 아니다.
        // `HeaderTitle`은 각각 heading 역할을 달고 나오므로, 그대로 두면 낭독에
        // 제목이 둘로 읽힌다. 바깥을 하나의 접근성 노드로 묶어 원래대로 되돌리고,
        // 라벨에는 **자르지 않은** 이름을 준다.
        <View
          style={styles.headerTitle}
          onLayout={onLayout}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${fullBabyName}의 오늘${suffix}`}>
          <HeaderTitle {...titleProps} numberOfLines={1} style={[style, styles.headerName]}>
            {displayBabyName}
          </HeaderTitle>
          <HeaderTitle {...titleProps} style={[style, styles.headerSuffix]}>
            {`의 오늘${suffix}`}
          </HeaderTitle>
        </View>
      ),
    };
    // **원본도 의존성이다.** 앞부분이 같고 뒤만 바뀌면 표시 문자열은 그대로라
    // 여기서 빠뜨리면 화면은 맞는데 낭독만 옛 이름으로 남는다.
  }, [fullBabyName, displayBabyName, dayCount, styles]);

  return (
    <View style={styles.container}>
      <Tabs.Screen options={screenOptions} />

      <ScrollView style={styles.cards} contentContainerStyle={styles.cardsContent}>
        {/* 수유는 한 카드, **두 줄**이다 — 지금(경과 시간·마지막 기록)과 오늘 합계.
            라벨·큰 숫자·구분선까지 다섯 줄로 쌓았더니 카드가 빠른 기록 영역을 밀어내
            작은 화면에서 잘렸다. 한 줄로도 줄여 봤지만 글자가 너무 작아졌다.

            줄마다 넘치면 줄을 바꾸지 않고 글자를 조금 줄인다. 줄을 바꾸면 카드 높이가
            데이터마다 달라져 다시 잘린다. 낭독은 위 `feedingLabel`의 완전한 문장이다. */}
        <View style={styles.card} accessible accessibilityLabel={feedingLabel}>
          {last ? (
            <>
              <Text
                style={styles.cardText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}>
                <Text style={styles.cardValue}>{formatElapsed(last.occurred_at, now)}</Text>
                {` · ${formatTimeOfDay(last.occurred_at)} ${feedingDetail(last.kind, last.side, last.amount_ml)}`}
              </Text>
              <Text
                style={styles.cardText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}>
                {todayLine}
              </Text>
            </>
          ) : (
            <Text style={styles.cardEmpty}>수유 기록 없음</Text>
          )}
        </View>

        <View style={styles.cardRow}>
          {/* 겹치는 수면이 하나도 없으면 0시간이 아니라 "기록 없음"이다.
              안 잔 것과 기록하지 않은 것은 다르다. */}
          <View style={styles.cardHalfFlat}>
            <Text style={styles.cardText}>오늘 수면</Text>
            {todaySleeps.length === 0 ? (
              <Text style={styles.cardEmpty}>기록 없음</Text>
            ) : (
              <Text style={styles.cardValue} numberOfLines={1}>
                {formatDurationCompact(sleepMs)}
              </Text>
            )}
          </View>
          <View style={styles.cardHalfFlat}>
            <Text style={styles.cardText}>오늘 기저귀</Text>
            <Text style={styles.cardValue} numberOfLines={1}>
              {diaperCount}회
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.quickArea}>
        {/* 모유는 위치만 고르면 끝이라 한 번에 저장한다. 분유는 양이 선택 입력이라
          원터치를 열면 `amount_ml`이 빈 기록이 쌓이고, 그러면 `분유 2회 · 120ml`가
          두 번의 총량처럼 읽혀 `오늘 분유량`과 통계를 믿기 어려워진다. 폼으로 보낸다.
          분유 버튼은 종류를 바꿀 수 있는 폼을 여는 것이라 수유의 `상세` 역할도 한다.
          아래 기저귀 줄과 같은 모양이다 — 파란 줄은 수유, 초록 줄은 기저귀. */}
        {/* 줄마다 제목을 단다. 색만으로는 부족하다 — `왼쪽`·`양쪽`에는 모유라는 말이
          없어 아래 기저귀 줄과 구분되는 단서가 색뿐이다. 색각 이상이면 그마저 없다. */}
        <View style={styles.quickGroup}>
          <View style={styles.groupHeader}>
            <View style={styles.barFeedingFlat} />
            <FixedText style={styles.groupTitle}>수유 기록</FixedText>
          </View>
          <View style={styles.buttons}>
            {BREAST_SIDES.map((side) => (
              <Pressable
                key={side}
                style={[styles.sideButtonFlat, savingRecord && styles.buttonBusy]}
                onPress={() => void onQuickFeeding(side)}
                disabled={savingRecord}
                accessibilityRole="button"
                accessibilityState={{ disabled: savingRecord }}
                accessibilityLabel={`모유 ${BREAST_SIDE_LABEL[side]} 기록`}>
                <FixedText style={styles.addButtonText}>{BREAST_SIDE_LABEL[side]}</FixedText>
              </Pressable>
            ))}
            <Pressable
              style={[styles.detailButtonFlat, savingRecord && styles.buttonBusy]}
              disabled={savingRecord}
              // 분유를 미리 골라 보낸다. 이름이 `분유`인 버튼을 눌렀는데 종류가
              // 비어 있으면, 그대로 저장했을 때 오류창부터 만난다.
              onPress={() => router.push('/feeding-form?kind=formula')}
              accessibilityRole="button"
              accessibilityState={{ disabled: savingRecord }}
              accessibilityLabel="분유 기록 입력">
              <FixedText style={styles.detailText}>분유</FixedText>
            </Pressable>
          </View>
        </View>

        {/* 기저귀는 화면을 넘기지 않고 지금 시각으로 바로 남긴다. 하루에 가장 자주
          하는 동작이라 두 번의 탭과 화면 전환이 그대로 비용이다. 시각을 고치거나
          메모를 남겨야 하면 `상세`로 기존 입력 화면에 들어간다. */}
        <View style={styles.quickGroup}>
          <View style={styles.groupHeader}>
            <View style={styles.barDiaperFlat} />
            <FixedText style={styles.groupTitle}>기저귀 기록</FixedText>
          </View>
          <View style={styles.buttons}>
            {DIAPER_KINDS.map((kind) => (
              <Pressable
                key={kind}
                style={[styles.diaperQuickFlat, savingRecord && styles.buttonBusy]}
                onPress={() => void onQuickDiaper(kind)}
                disabled={savingRecord}
                accessibilityRole="button"
                accessibilityState={{ disabled: savingRecord }}
                accessibilityLabel={`${DIAPER_KIND_LABEL[kind]} 기록`}>
                <FixedText style={styles.addButtonText}>{DIAPER_KIND_LABEL[kind]}</FixedText>
              </Pressable>
            ))}
            {/* `Link asChild`를 쓰지 않는다. 래퍼 View가 flex를 받지 않아 이 버튼만
              폭이 달라진다. 옆 셋과 같은 크기여야 한 줄로 읽힌다. */}
            <Pressable
              style={[styles.detailButtonFlat, savingRecord && styles.buttonBusy]}
              disabled={savingRecord}
              onPress={() => router.push('/diaper-form')}
              accessibilityRole="button"
              accessibilityState={{ disabled: savingRecord }}
              accessibilityLabel="기저귀 상세 입력">
              <FixedText style={styles.detailText}>상세</FixedText>
            </Pressable>
          </View>
        </View>

        {/* 수면은 하루 2~4회라 모유·기저귀와 같은 무게일 이유가 없다. 제목과 행동을
          한 줄로 묶어 상태는 왼쪽, 누를 것은 오른쪽 끝에 둔다.
          상태와 버튼을 각각 읽도록 접근성 노드를 나눈다 — 하나로 묶으면
          `수면 중 32분 수면 종료`가 한 덩어리로 낭독된다. */}
        <View style={styles.sleepRowLine}>
          <View
            style={sleepCardStyle(styles, activeSleep !== null, sleepOverdue)}
            accessible
            accessibilityLabel={sleepStatusLabel}>
            <Ionicons name="bed" size={18} color={colors.onAccent} />
            <FixedText style={styles.sleepStateValue} numberOfLines={1}>
              {sleepLine}
            </FixedText>
          </View>
          {/* 상태 카드와 **형제**다. 카드 안에 넣으면 안쪽 여백 때문에 버튼이
              잘리거나 줄어든다. 둘 다 65dp에 같은 상태색이라 한 덩어리로 읽히고,
              떨어져 있어 오른쪽만 누르는 곳이라는 것도 보인다. */}
          <Pressable
            style={({ pressed }) => [
              sleepButtonStyle(styles, activeSleep !== null, sleepOverdue),
              (pressed || toggling) && styles.buttonBusy,
            ]}
            onPress={onPressSleep}
            disabled={toggling}
            accessibilityRole="button"
            accessibilityState={{ disabled: toggling }}
            accessibilityLabel={activeSleep ? '수면 종료' : '수면 시작'}>
            <FixedText style={styles.addButtonText}>{activeSleep ? '종료' : '시작'}</FixedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(c: Colors) {
  const s = StyleSheet.create({
    // 하단 안전 영역은 탭 바가 이미 비운다. 여기서 또 비우면 그 높이만큼
    // 빠른 기록 아래가 버려지고 위 카드가 잘린다(테스트 기기 3버튼 내비에서 약 48dp).
    // 아래 여백만 작게 둬서 빠른 기록이 탭 바 바로 위에 붙게 한다.
    container: {
      flex: 1,
      backgroundColor: c.background,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      gap: 12,
    },
    // 이름만 줄어들게 하는 두 조각 제목. 컨테이너가 `flexShrink: 1`이라 헤더가
    // 주는 폭 안에서 줄어들고, 그 줄어듦을 이름 쪽이 전부 받는다.
    headerTitle: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
    headerName: { flexShrink: 1 },
    headerSuffix: { flexShrink: 0 },
    // 카드는 스크롤한다. 고정 높이 컬럼은 항목이 늘면 버튼 뒤로 잘린다.
    cards: { flex: 1 },
    // 끝까지 내렸을 때 마지막 카드가 경계에 붙지 않도록 여백을 준다.
    cardsContent: { gap: 12, paddingBottom: 12 },
    cardRow: { flexDirection: 'row', gap: 12 },
    // 세 카드가 **한 벌**을 쓴다. 따로 두었더니 수유 카드만 줄인 뒤 반폭 카드의
    // 숫자(24)가 경과 시간(20)보다 커져 위계가 뒤집혔다.
    card: { backgroundColor: c.surface, borderRadius: 14, padding: 12, gap: 4 },
    cardHalf: { flex: 1 },
    // 값 — 굵게는 이것 하나다. 보조 글자까지 굵게 하면 경과 시간과 한 덩어리로 보인다.
    cardValue: { fontSize: 20, fontWeight: '700', color: c.text },
    // 라벨과 보조 문구. `textMuted`가 아니라 `textLabel`이다 — 다크에서 `textMuted`(5.9:1)를
    // 얇게 쓰니 흐려서 읽히지 않았다. 크기보다 색이 원인이었다.
    cardText: { fontSize: 16, color: c.textLabel },
    // 값과 같은 크기라 `기록 없음`이어도 카드 높이가 같다.
    cardEmpty: { fontSize: 20, color: c.textPlaceholder },
    buttons: { flexDirection: 'row', gap: 8 },
    quickGroup: { gap: 6 },
    // 제목이 보조 설명처럼 묻히지 않게 한다. 세로선은 높이를 거의 쓰지 않으면서
    // 그룹 경계를 만들고, 그 줄의 색이 아래 버튼과 같아 무엇의 제목인지 바로 붙는다.
    // 색만으로 구분하지 않고 글자가 함께 있으므로 색각과 무관하게 읽힌다.
    groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    groupTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    groupBar: { width: 3, height: 16, borderRadius: 2, alignSelf: 'center' },
    barFeeding: { backgroundColor: c.accent },
    barDiaper: { backgroundColor: c.diaper },
    // 내용이 없어도 이 높이는 유지된다. 큰 글꼴에서 두 줄이 되면 늘어난다 —
    // 잘라내는 것보다 낫다.
    quickArea: { gap: 12 },
    // 저장 중 표시. 비활성 컨트롤이라 대비 기준에서 빠진다.
    buttonBusy: { opacity: 0.5 },
    // `상세`는 옆 셋보다 가볍게 둔다 — 즉시 저장이 아니라 입력 화면을 여는
    // 버튼이라 같은 무게면 안 된다. 그래서 채운 색이 아니라 옅은 배경을 쓴다.
    //
    // **다만 테두리가 있어야 버튼이다.** 채움만으로는 `surfaceAccent`와 화면 배경의
    // 대비가 라이트 1.03:1, 다크 1.45:1이라 경계가 보이지 않는다. 옆 기저귀
    // 버튼은 4.81:1 / 3.91:1로 통과하는데 이것만 미달이었다.
    // 테두리 `accentText`는 5.71:1 / 9.60:1이다.
    //
    // 행이 `alignItems: 'stretch'`라 테두리로 2px 커져도 네 버튼 높이는 같다.
    // 네 버튼은 같은 폭이다. `상세`만 좁히면 한 줄 안에서 크기가 안 맞는다.
    // 360dp에서 (320 - 24) / 4 = 74dp씩이라 세 글자인 `대소변`도 들어간다.
    detailButton: {
      backgroundColor: c.surfaceAccent,
      borderWidth: 1,
      borderColor: c.accentText,
    },
    detailText: { fontSize: 17, fontWeight: '700', color: c.accentText },
    sideButton: { backgroundColor: c.accent },
    // flex는 가로 행 버튼에만. 세로 컨테이너의 직계 자식에 주면 남는 높이를
    // 전부 먹어 다른 카드를 덮는다.
    addButton: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 20,
      alignItems: 'center',
    },
    inRow: { flex: 1 },
    diaperButton: { backgroundColor: c.diaper },
    // 버튼 전체 색이 바뀌어야 상태가 바뀐 것으로 읽힌다. 아이콘과 글자만
    // 바꾸면 눌렀는지 아닌지 알기 어렵다.
    //
    // 밝은 주황은 어두운 환경에서 지나치게 밝고 흰 글자 대비도 모자랐다.
    // 차분한 톤으로 낮춰 대비를 얻었고, 수치는 `theme/colors.test.ts`가 지킨다.
    //
    // 12시간을 넘기면 한 단계 더 진한 색으로 간다. 주황 위에 노란 글씨를 얹으면
    // 대비가 나빠 안내가 묻힌다.
    sleepStartButton: { backgroundColor: c.sleepIdle },
    sleepActiveButton: { backgroundColor: c.sleepActive },
    sleepOverdueButton: { backgroundColor: c.sleepOverdue },
    // 수면 컨트롤은 위 두 버튼과 같은 addButton을 쓴다. 한 줄에 같은 글자 크기라
    // 높이가 따로 지정하지 않아도 같아진다. 숫자로 박으면 글자 크기를 키운
    // 기기에서 어긋난다.
    // flexDirection이 row가 되면 alignItems는 세로만 맡는다. 가로 가운데는
    // justifyContent가 한다. 진행 중 상태는 아래 space-between이 덮어쓴다.
    // 상태 카드와 버튼이 **형제**다. 둘 다 같은 상태색이라 한 덩어리로 읽히고,
    // 8dp 떨어져 있어 오른쪽만 누르는 곳이라는 것도 보인다. 예전 전폭 수면
    // 버튼의 또렷한 상태 신호를 그대로 살린 모양이다.
    // 투명한 래퍼. 색은 아래 두 형제가 각자 칠한다.
    sleepRowLine: { flexDirection: 'row', gap: 8 },
    sleepStatus: {
      flex: 1,
      height: 65,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 12,
    },
    sleepStateValue: { flexShrink: 1, fontSize: 17, fontWeight: '700', color: c.onAccent },
    // 위 `분유`·`상세`와 같은 80 × 65dp.
    sleepAction: {
      width: 80,
      height: 65,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonText: { fontSize: 17, fontWeight: '700', color: c.onAccent },
  });

  // 미리 합쳐 둔 버튼 스타일. 조합이 많아 호출부에서 배열을 만들면 읽기 어렵다.
  return {
    ...s,
    diaperQuickFlat: StyleSheet.flatten([s.addButton, s.inRow, s.diaperButton]),
    detailButtonFlat: StyleSheet.flatten([s.addButton, s.inRow, s.detailButton]),
    sideButtonFlat: StyleSheet.flatten([s.addButton, s.inRow, s.sideButton]),
    barFeedingFlat: StyleSheet.flatten([s.groupBar, s.barFeeding]),
    barDiaperFlat: StyleSheet.flatten([s.groupBar, s.barDiaper]),
    sleepCardIdleFlat: StyleSheet.flatten([s.sleepStatus, s.sleepStartButton]),
    sleepCardActiveFlat: StyleSheet.flatten([s.sleepStatus, s.sleepActiveButton]),
    sleepCardOverdueFlat: StyleSheet.flatten([s.sleepStatus, s.sleepOverdueButton]),
    sleepBtnIdleFlat: StyleSheet.flatten([s.sleepAction, s.sleepStartButton]),
    sleepBtnActiveFlat: StyleSheet.flatten([s.sleepAction, s.sleepActiveButton]),
    sleepBtnOverdueFlat: StyleSheet.flatten([s.sleepAction, s.sleepOverdueButton]),
    cardHalfFlat: StyleSheet.flatten([s.card, s.cardHalf]),
  };
}

type Styles = ReturnType<typeof createStyles>;

function sleepCardStyle(styles: Styles, active: boolean, overdue: boolean) {
  if (!active) return styles.sleepCardIdleFlat;
  return overdue ? styles.sleepCardOverdueFlat : styles.sleepCardActiveFlat;
}

function sleepButtonStyle(styles: Styles, active: boolean, overdue: boolean) {
  if (!active) return styles.sleepBtnIdleFlat;
  return overdue ? styles.sleepBtnOverdueFlat : styles.sleepBtnActiveFlat;
}
