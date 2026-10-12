import { useCallback } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  formatDateLabel,
  formatKcal,
  formatYen,
  progressRatio,
  type ApiClient,
  type DaySummary,
} from '@calorie-donate/api';
import {
  Badge,
  Loading,
  Notice,
  ProgressBar,
  SectionTitle,
} from '../components';
import {
  DailyChart,
  HabitCalendar,
  MealTypeBars,
  StatTiles,
  WeekdayBars,
} from '../HabitCharts';
import { useRemote } from '../useRemote';
import { colors, radius } from '../theme';

const HISTORY_DAYS = 30;
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
  const fetchData = useCallback(async () => {
    const [stats, history] = await Promise.all([
      api.stats(STATS_DAYS),
      api.history(HISTORY_DAYS),
    ]);
    const days = [...history.days].sort((a, b) => b.date.localeCompare(a.date));
    return { stats, days };
  }, [api]);
  const { data, error, refreshing, reload, refresh } = useRemote(fetchData);

  const header = (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">
        グラフ
      </Text>
      <Text style={styles.subtitle}>
        直近{STATS_DAYS / 7}週間の記録の習慣と、日ごとの記録です。
      </Text>
      {error ? <Notice message={error} onRetry={reload} /> : null}
      {data ? (
        <View style={styles.charts}>
          <StatTiles stats={data.stats} />
          <DailyChart stats={data.stats} />
          <HabitCalendar stats={data.stats} />
          <WeekdayBars stats={data.stats} />
          <MealTypeBars stats={data.stats} />
          <View style={styles.listHeader}>
            <SectionTitle>日ごとの記録</SectionTitle>
            <Text style={styles.subtitle}>
              直近{HISTORY_DAYS}
              日間。今日と昨日は「暫定」、それより前は「確定」です。
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  if (!data) {
    return (
      <View style={styles.flex}>
        <View style={styles.padded}>{header}</View>
        {error ? null : <Loading />}
      </View>
    );
  }

  return (
    <FlatList
      data={data.days}
      keyExtractor={(day) => day.date}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Text style={styles.empty}>まだ履歴がありません</Text>
      }
      ItemSeparatorComponent={Separator}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      renderItem={({ item }) => (
        <DayRow
          day={item}
          today={today}
          onPress={() => onSelectDay(item.date)}
        />
      )}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function DayRow({
  day,
  today,
  onPress,
}: {
  day: DaySummary;
  today: string;
  onPress: () => void;
}) {
  const over = day.overKcal > 0;
  const settled = day.status === 'settled';
  const label = formatDateLabel(day.date, today);
  const balance = over
    ? `${formatKcal(day.overKcal)} 超過`
    : `${formatKcal(day.remainingKcal)} 余裕`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}、${formatKcal(day.consumedKcal)}、${balance}${over ? `、寄付 ${formatYen(day.donationYen)}` : ''}、${settled ? '確定' : '暫定'}`}
      accessibilityHint={
        day.editable
          ? '開いて編集できます'
          : '開いて内容を確認できます（閲覧のみ）'
      }
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.date}>{label}</Text>
        <Badge
          label={settled ? '確定' : '暫定'}
          tone={settled ? 'neutral' : 'primary'}
        />
      </View>
      <ProgressBar
        ratio={progressRatio(day.consumedKcal, day.targetKcal)}
        over={over}
        height={8}
        label={`${label}の目標に対する摂取量`}
      />
      <View style={styles.rowBottom}>
        <Text style={styles.kcal}>
          {day.consumedKcal.toLocaleString('ja-JP')} /{' '}
          {formatKcal(day.targetKcal)}
        </Text>
        <Text style={[styles.balance, over && styles.overText]}>{balance}</Text>
      </View>
      {over ? (
        <Text style={styles.donation}>
          {settled ? '寄付' : '寄付見込み'} {formatYen(day.donationYen)}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { padding: 20 },
  list: { padding: 20, paddingBottom: 40 },
  header: { gap: 6, marginBottom: 16 },
  charts: { gap: 16, marginTop: 10 },
  listHeader: { gap: 4, marginTop: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  empty: { color: colors.muted, textAlign: 'center', padding: 32 },
  separator: { height: 10 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  pressed: { opacity: 0.7 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  kcal: { color: colors.muted, fontSize: 13 },
  balance: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  overText: { color: colors.accent },
  donation: { color: colors.accentText, fontSize: 13, fontWeight: '700' },
});
