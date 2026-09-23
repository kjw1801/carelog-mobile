import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getRecentDayStats, type RecentStats } from '@/db/stats';
import {
  barDayLabel,
  barValueLabel,
  sleepMinutesLabel,
  sleepMsByDay,
  toBars,
  type Bar,
  type DayValue,
} from '@/lib/stats';
import { formatDay, formatDuration, todayRange } from '@/lib/time';
import { type Colors } from '@/theme/colors';
import { useColors } from '@/theme/useColors';

const DAYS = 7;

type ChartProps = {
  /** 지표 이름. 제목과 낭독 라벨에 함께 쓴다. */
  name: string;
  /** 단위. 제목에 한 번만 붙이고, 낭독에서는 값 뒤에 붙는다. */
  unit: string;
  values: DayValue[];
  starts: number[];
  todayStart: number;
  format: (value: number) => string;
  /** 낭독용 값 표현. 없으면 `format` 결과에 단위를 붙인다. */
  describe?: (value: number) => string;
  color: string;
  styles: ReturnType<typeof createStyles>;
};

function Chart({
  name,
  unit,
  values,
  starts,
  todayStart,
  format,
  describe,
  color,
  styles,
}: ChartProps) {
  // 지표마다 따로 부른다. 한 최댓값으로 묶으면 큰 쪽만 보이는 그래프가 된다.
  const bars: Bar[] = toBars(values);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{`${name} (${unit})`}</Text>
      <View style={styles.chart}>
        {bars.map((bar, index) => {
          const isToday = starts[index] === todayStart;
          // 막대·날짜·값이 따로 낭독되면 어느 날의 어떤 값인지 이어지지 않는다.
          // 한 노드로 묶고 지표·날짜·값을 한 문장으로 준다.
          const spoken =
            bar.value === null
              ? '기록 없음'
              : (describe ?? ((value: number) => `${format(value)}${unit}`))(bar.value);
          return (
            <View
              key={starts[index]}
              style={styles.column}
              accessible
              accessibilityLabel={`${isToday ? '오늘' : formatDay(starts[index])}, ${name} ${spoken}`}>
              {/* 막대만으로는 `0`과 `기록 없음`이 같아 보인다. 숫자를 함께 둔다. */}
              <Text style={styles.value} numberOfLines={1}>
                {barValueLabel(bar.value, format)}
              </Text>
              <View style={styles.track}>
                {/* 값이 0이거나 기록이 없으면 막대를 아예 그리지 않는다. 최소 높이를
                  주면 0인 날에도 얇은 선이 남아 "아주 작은 값"으로 읽힌다. */}
                {bar.ratio > 0 ? (
                  <View
                    style={[styles.bar, { backgroundColor: color, height: `${bar.ratio * 100}%` }]}
                  />
                ) : null}
              </View>
              <Text style={styles.day} numberOfLines={1}>
                {barDayLabel(starts[index], todayStart)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const db = useSQLiteContext();
  const [stats, setStats] = useState<RecentStats>({ days: [], sleeps: [] });
  const [now, setNow] = useState(() => Date.now());

  // 진행 중인 수면은 1분마다, 그리고 앱이 foreground로 돌아올 때 갱신한다.
  // 타이머는 백그라운드에서 멈추거나 느려지므로, 복귀 시점에 한 번 더 읽지 않으면
  // 다음 틱까지 최대 1분 동안 옛 값이 남는다. Today 화면과 같은 방식이다.
  //
  // 갱신해도 DB를 다시 읽지는 않는다 — 기준 시각은 그대로고 현재 시각만 변한다.
  // 단 이 갱신으로 날짜가 넘어가면 아래 dayStart가 바뀌면서 집계는 다시 조회된다.
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

  const dayStart = todayRange(new Date(now)).start;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      // 조회에 실패하면 화면을 그대로 둔다. 다음 포커스나 날짜 변경 때 다시 읽는다.
      getRecentDayStats(db, new Date(dayStart), DAYS)
        .then((rows) => {
          if (alive) setStats(rows);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [db, dayStart])
  );

  const { days, sleeps } = stats;

  // 진행 중인 수면은 시간이 흐르면 길어진다. 조회 결과를 숫자로 접어두면 화면을
  // 열어둔 동안 오늘 막대가 얼어붙으므로, now가 바뀔 때마다 다시 센다.
  // 1분 타이머가 now를 갱신하므로 DB는 매분 조회하지 않는다.
  const sleepMs = useMemo(
    () =>
      sleepMsByDay(
        sleeps,
        days.map((day) => day.range),
        now
      ),
    [sleeps, days, now]
  );

  const starts = days.map((day) => day.range.start);
  const todayStart = starts[starts.length - 1] ?? 0;
  const shared = { starts, todayStart, styles };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Chart
          {...shared}
          name="수유"
          unit="회"
          values={days.map((day) => day.feedingCount)}
          format={(n) => `${n}`}
          color={colors.accent}
        />
        <Chart
          {...shared}
          name="분유량"
          unit="ml"
          values={days.map((day) => day.formulaMl)}
          format={(n) => `${n}`}
          color={colors.accent}
        />
        <Chart
          {...shared}
          name="기저귀"
          unit="회"
          values={days.map((day) => day.diaperCount)}
          format={(n) => `${n}`}
          color={colors.diaper}
        />
        <Chart
          {...shared}
          name="수면"
          unit="분"
          values={sleepMs}
          format={sleepMinutesLabel}
          // 낭독은 `<1`이 아니라 `1분 미만`으로 읽혀야 한다. 기존 포맷을 그대로 쓴다.
          describe={formatDuration}
          color={colors.sleepDot}
        />
      </ScrollView>
    </View>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    // 하단 안전 영역은 탭 바가 이미 비운다. 여기서 또 비우면 마지막 차트 아래가
    // 그만큼 버려진다(테스트 기기 3버튼 내비에서 약 48dp). 오늘 화면과 같은 원인이다.
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 8, paddingBottom: 12 },
    card: { backgroundColor: c.surface, borderRadius: 14, padding: 10, gap: 4 },
    cardTitle: { fontSize: 13, color: c.textMuted },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    column: { flex: 1, alignItems: 'center', gap: 2 },
    // 막대가 자랄 자리. 높이를 숫자로 박아야 비율이 의미를 갖는다.
    track: { width: '100%', height: 44, justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 4, minHeight: 2 },
    value: { fontSize: 11, color: c.text },
    day: { fontSize: 11, color: c.textMuted },
  });
}
