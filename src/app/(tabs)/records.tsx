import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { DIAPER_KIND_LABEL } from '@/db/diapers';
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

function describe(entry: TimelineEntry): string {
  if (entry.type === 'feeding') {
    return entry.amount_ml === null ? '양 기록 없음' : `${entry.amount_ml}ml`;
  }
  if (entry.type === 'diaper') {
    return entry.diaper_kind === null ? '' : DIAPER_KIND_LABEL[entry.diaper_kind];
  }
  // 수면은 구간이다. 진행 중이면 아직 길이가 없다.
  if (entry.sleep_ended_at === null) return '진행 중';
  const duration = formatDuration(entry.sleep_ended_at - entry.occurred_at);
  const endTime = formatTimeOfDay(entry.sleep_ended_at);
  // 자정을 넘긴 수면은 종료 시각만 쓰면 같은 날인지 알 수 없다.
  const end = isSameDay(entry.occurred_at, entry.sleep_ended_at)
    ? `~${endTime}`
    : `~${formatDay(entry.sleep_ended_at)} ${endTime}`;
  return `${duration} · ${end}`;
}

const TYPE_LABEL: Record<TimelineEntry['type'], string> = {
  feeding: '수유',
  diaper: '기저귀',
  sleep: '수면',
};

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
      renderItem={({ item }) => (
        <Link
          href={{ pathname: FORM_PATH[item.type], params: { id: item.id } }}
          asChild>
          <Pressable style={styles.row} accessibilityRole="button">
            <Text style={styles.rowTime}>{formatTimeOfDay(item.occurred_at)}</Text>
            <View style={TAG_STYLE[item.type]}>
              <Text style={styles.tagText}>{TYPE_LABEL[item.type]}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowDetail}>{describe(item)}</Text>
              {item.note ? (
                <Text style={styles.rowNote} numberOfLines={1}>
                  {item.note}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f2f2f7' },
  listContent: { padding: 16 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f2f7',
    gap: 8,
  },
  emptyText: { fontSize: 16, color: '#8a8a8e' },
  emptyHint: { fontSize: 14, color: '#b0b0b5' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8a8a8e',
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rowTime: { fontSize: 17, fontWeight: '600', color: '#1c1c1e', minWidth: 56 },
  tag: { borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  tagFeeding: { backgroundColor: '#e5f0ff' },
  tagDiaper: { backgroundColor: '#e6f4ea' },
  tagSleep: { backgroundColor: '#e8e7f0' },
  tagText: { fontSize: 12, fontWeight: '600', color: '#3a3a3c' },
  rowBody: { flex: 1, gap: 2 },
  rowDetail: { fontSize: 16, color: '#1c1c1e' },
  rowNote: { fontSize: 14, color: '#8a8a8e' },
});

const TAG_STYLE: Record<TimelineEntry['type'], object> = {
  feeding: StyleSheet.flatten([styles.tag, styles.tagFeeding]),
  diaper: StyleSheet.flatten([styles.tag, styles.tagDiaper]),
  sleep: StyleSheet.flatten([styles.tag, styles.tagSleep]),
};
