import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { listFeedings, type Feeding } from '@/db/feedings';
import { formatDay, formatTimeOfDay, isSameDay } from '@/lib/time';

type Section = { title: string; data: Feeding[] };

/** 시간 역순으로 정렬된 목록을 현지 날짜별로 묶는다. */
function groupByDay(rows: Feeding[]): Section[] {
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

export default function RecordsScreen() {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<Feeding[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listFeedings(db).then((result) => {
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
        <Text style={styles.emptyText}>아직 기록이 없습니다람쥐</Text>
      </View>
    );
  }

  return (
    <SectionList
      style={styles.list}
      sections={sections}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/feeding-form', params: { id: item.id } }} asChild>
          <Pressable style={styles.row} accessibilityRole="button">
            <Text style={styles.rowTime}>{formatTimeOfDay(item.occurred_at)}</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowAmount}>
                {item.amount_ml === null ? '양 기록 없음' : `${item.amount_ml}ml`}
              </Text>
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f2f7' },
  emptyText: { fontSize: 16, color: '#8a8a8e' },
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
    gap: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rowTime: { fontSize: 17, fontWeight: '600', color: '#1c1c1e', minWidth: 56 },
  rowBody: { flex: 1, gap: 2 },
  rowAmount: { fontSize: 16, color: '#1c1c1e' },
  rowNote: { fontSize: 14, color: '#8a8a8e' },
});
