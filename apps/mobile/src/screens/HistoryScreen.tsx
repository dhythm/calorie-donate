import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ApiClient } from '@calorie-donate/api';
import { Loading, Notice } from '../components';
import {
  DailyChart,
  HabitCalendar,
  MealTypeBars,
  StatTiles,
  WeekdayBars,
} from '../HabitCharts';
import { PeriodHistory } from '../PeriodHistory';
import { useRemote } from '../useRemote';
import { colors } from '../theme';

const STATS_DAYS = 84;

export function HistoryScreen({
  api,
  today,
  onSelectDay,
}: {
  api: ApiClient;
  today: string;
  onSelectDay: (date: string) => void;
}) {
  const fetchData = useCallback(() => api.stats(STATS_DAYS), [api]);
  const { data, error, refreshing, reload, refresh } = useRemote(fetchData);
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            refresh();
            setRefreshKey((value) => value + 1);
          }}
          tintColor={colors.text}
          colors={[colors.text]}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          グラフ
        </Text>
        <Text style={styles.subtitle}>
          直近12週間のグラフと、週・月・年で選べる記録サマリーです。
        </Text>
      </View>
      {error ? <Notice message={error} onRetry={reload} /> : null}
      {data ? (
        <View style={styles.charts}>
          <StatTiles stats={data} />
          <DailyChart stats={data} />
          <HabitCalendar stats={data} />
          <WeekdayBars stats={data} />
          <MealTypeBars stats={data} />
        </View>
      ) : !error ? (
        <Loading />
      ) : null}
      <PeriodHistory
        api={api}
        today={today}
        onSelectDay={onSelectDay}
        refreshKey={refreshKey}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 24, paddingBottom: 40, gap: 28 },
  header: { gap: 8, marginBottom: 24 },
  charts: { gap: 16, marginTop: 10 },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});
