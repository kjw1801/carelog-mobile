import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { DIAPER_KIND_LABEL } from '@/db/diapers';
import { BREAST_SIDE_LABEL, FEEDING_KIND_LABEL } from '@/db/feedings';
import { listTimeline, type TimelineEntry } from '@/db/timeline';
import { formatDay, formatDuration, formatTimeOfDay, isSameDay } from '@/lib/time';

type Section = { title: string; data: TimelineEntry[] };

/** 시간 역순으로 정렬된 목록을 현지 날짜별로 묶는다. */
function groupByDay(rows: TimelineEntry[]): Section[] {
  const sections: Section[] = [];
  for (const row of rows) {
    const current = sections[sections.length - 1];
    if (current && isSameDay(current.data[0].occurred_at, row.occurred_at)) {
      current.data.push(row);
    } else {
      sections.push({ title: formatDay(row.occurred_at), data: [row] });
    }
  }
  return sections;
}

const TITLE: Record<TimelineEntry['type'], string> = {
  feeding: '수유',
  diaper: '기저귀',
  sleep: '수면',
};

/**
 * 종류 옆에 붙는 값. 없으면 그리지 않는다.
 *
 * 세 종류가 같은 자리에 각자의 값을 둔다 — 수유는 양, 수면은 잔 시간,
 * 기저귀는 무엇을 쌌는지. 수유량을 입력하지 않았으면 `양 기록 없음` 같은
 * 문구도 넣지 않는다. 빈 자리가 있는 편이 훑어볼 때 빠르다.
 */
function detail(entry: TimelineEntry): string | null {
  if (entry.type === 'feeding') {
    const amount = entry.amount_ml === null ? null : `${entry.amount_ml}ml`;
    if (entry.feeding_kind === 'breast') {
      return entry.feeding_side === null ? '모유' : `모유 ${BREAST_SIDE_LABEL[entry.feeding_side]}`;
    }
    if (entry.feeding_kind === 'formula') {
      const label = FEEDING_KIND_LABEL.formula;
      return amount === null ? label : `${label} ${amount}`;
    }
    // v4까지의 기록. 양만 보여주면 분유로 오해한다 — 추정하지 않으려고
    // unspecified를 뒀는데 화면에서 감추면 의미가 없다.
    return amount === null ? '기존 기록' : `기존 기록 · ${amount}`;
  }
  if (entry.type === 'diaper') {
    return entry.diaper_kind === null ? null : DIAPER_KIND_LABEL[entry.diaper_kind];
  }
  if (entry.sleep_ended_at === null) return '진행 중';
  return formatDuration(entry.sleep_ended_at - entry.occurred_at);
}

// typedRoutes가 켜져 있어 Href는 리터럴 유니온이다. string으로 넓히면 거부된다.
const FORM_PATH = {
  feeding: '/feeding-form',
  diaper: '/diaper-form',
  sleep: '/sleep-form',
} as const;

export default function RecordsScreen() {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<TimelineEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listTimeline(db).then((result) => {
        if (alive) setRows(result);
      });
      return () => {
        alive = false;
      };
    }, [db])
  );

  const sections = useMemo(() => groupByDay(rows), [rows]);

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>아직 기록이 없습니다</Text>
        <Text style={styles.emptyHint}>오늘 화면에서 기록을 추가해 보세요</Text>
      </View>
    );
  }

  return (
    <SectionList
      style={styles.list}
      sections={sections}
      keyExtractor={(item) => `${item.type}-${item.id}`}
      contentContainerStyle={styles.listContent}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => {
        const sub = detail(item);
        return (
          <Link href={{ pathname: FORM_PATH[item.type], params: { id: item.id } }} asChild>
            <Pressable style={styles.row} accessibilityRole="button">
              <Text style={styles.time}>{formatTimeOfDay(item.occurred_at)}</Text>
              <View style={styles.body}>
                <View style={styles.titleRow}>
                  {/* 아이콘 대신 색 점을 쓴다. 기저귀에 어울리는 아이콘이 없어
                      셋을 맞추려면 하나는 억지가 된다. 종류는 바로 옆에 있다. */}
                  <View style={DOT_STYLE[item.type]} />
                  <Text style={styles.title}>{TITLE[item.type]}</Text>
                  {/* 값은 종류 바로 옆에 붙인다. flex로 밀어 오른쪽 끝에 두면
                      한 줄인데도 눈이 두 번 움직인다. */}
                  {sub ? (
                    <Text style={styles.detail} numberOfLines={1}>
                      {sub}
                    </Text>
                  ) : null}
                </View>
                {item.note ? (
                  <Text style={styles.note} numberOfLines={1}>
                    {item.note}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#fff' },
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 8,
  },
  emptyText: { fontSize: 16, color: '#8a8a8e' },
  emptyHint: { fontSize: 14, color: '#b0b0b5' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8a8a8e',
    backgroundColor: '#fff',
    paddingTop: 20,
    paddingBottom: 8,
  },
  // 카드도 테두리도 없다. 왼쪽 시각 열과 여백만으로 줄이 갈린다.
  row: { flexDirection: 'row', gap: 16, paddingVertical: 12 },
  time: { fontSize: 16, fontWeight: '700', color: '#1c1c1e', width: 64 },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotFeeding: { backgroundColor: '#0a84ff' },
  dotDiaper: { backgroundColor: '#34a853' },
  dotSleep: { backgroundColor: '#5b597a' },
  title: { fontSize: 16, fontWeight: '600', color: '#1c1c1e' },
  detail: { fontSize: 15, color: '#3a3a3c', flexShrink: 1 },
  note: { fontSize: 14, color: '#8a8a8e' },
});

const DOT_STYLE: Record<TimelineEntry['type'], object> = {
  feeding: StyleSheet.flatten([styles.dot, styles.dotFeeding]),
  diaper: StyleSheet.flatten([styles.dot, styles.dotDiaper]),
  sleep: StyleSheet.flatten([styles.dot, styles.dotSleep]),
};
