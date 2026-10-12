import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  dateKeySchema,
  formatDateLabel,
  formatKcal,
  formatYen,
  historyPeriodLabel,
  historyPeriodRange,
  shiftHistoryPeriod,
  type ApiClient,
  type HistoryPeriod,
} from '@calorie-donate/api';
import {
  Badge,
  Button,
  Field,
  Loading,
  Notice,
  SectionTitle,
  Segmented,
} from './components';
import { useRemote } from './useRemote';
import { colors } from './theme';

const periods = [
  { value: 'week', label: '週', current: '今週' },
  { value: 'month', label: '月', current: '今月' },
  { value: 'year', label: '年', current: '今年' },
] as const;

export function PeriodHistory({
  api,
  today,
  onSelectDay,
  refreshKey = 0,
}: {
  api: ApiClient;
  today: string;
  onSelectDay: (date: string) => void;
  refreshKey?: number;
}) {
  const [period, setPeriod] = useState<HistoryPeriod>('week');
  const [anchor, setAnchor] = useState(today);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [year, setYear] = useState(today.slice(0, 4));
  const [month, setMonth] = useState(today.slice(5, 7));
  const [error, setError] = useState<string | null>(null);
  const range = historyPeriodRange(period, anchor);
  const next = shiftHistoryPeriod(period, anchor, 1);
  const selected = periods.find((item) => item.value === period)!;
  const selectDate = (date: string) => {
    setAnchor(date);
    setYear(date.slice(0, 4));
    setMonth(date.slice(5, 7));
    setError(null);
  };
  const apply = () => {
    const date = `${year.padStart(4, '0')}-${period === 'year' ? '01' : month.padStart(2, '0')}-01`;
    if (
      !dateKeySchema.safeParse(date).success ||
      date > today ||
      Number(year) < 1
    ) {
      setError('今日以前の有効な年月を入力してください。');
      return;
    }
    selectDate(date);
    setPickerOpen(false);
  };

  return (
    <View style={styles.section}>
      <SectionTitle>記録サマリー</SectionTitle>
      <Segmented
        options={periods}
        value={period}
        onChange={(value) => {
          setPeriod(value);
          setPickerOpen(false);
          setError(null);
        }}
        label="記録の表示単位"
      />
      <View style={styles.navigation}>
        <Button
          title="‹"
          compact
          variant="secondary"
          accessibilityLabel={`前の${selected.label}`}
          onPress={() => selectDate(shiftHistoryPeriod(period, anchor, -1))}
        />
        <Text style={styles.periodLabel} accessibilityLiveRegion="polite">
          {historyPeriodLabel(period, anchor)}
        </Text>
        <Button
          title="›"
          compact
          variant="secondary"
          accessibilityLabel={`次の${selected.label}`}
          disabled={historyPeriodRange(period, next).from > today}
          onPress={() => selectDate(next)}
        />
      </View>
      <View style={styles.actions}>
        <Button
          title={`${selected.current}に戻る`}
          compact
          variant="ghost"
          disabled={range.from === historyPeriodRange(period, today).from}
          onPress={() => selectDate(today)}
        />
        {period !== 'week' && (
          <Button
            title={period === 'year' ? '年を選ぶ' : '年月を選ぶ'}
            compact
            variant="ghost"
            onPress={() => setPickerOpen((value) => !value)}
          />
        )}
      </View>
      {pickerOpen && (
        <View style={styles.picker}>
          <View style={styles.yearInput}>
            <Field
              label="表示年"
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
          {period === 'month' && (
            <View style={styles.monthInput}>
              <Field
                label="表示月"
                value={month}
                onChangeText={setMonth}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          )}
          <Button title="移動" compact onPress={apply} />
        </View>
      )}
      {error && <Notice message={error} />}
      <PeriodRows
        key={`${period}/${anchor}/${refreshKey}`}
        api={api}
        period={period}
        anchor={anchor}
        onSelectDay={onSelectDay}
        onMonth={(value) => {
          selectDate(`${value}-01`);
          setPeriod('month');
        }}
      />
    </View>
  );
}

function PeriodRows({
  api,
  period,
  anchor,
  onSelectDay,
  onMonth,
}: {
  api: ApiClient;
  period: HistoryPeriod;
  anchor: string;
  onSelectDay: (date: string) => void;
  onMonth: (month: string) => void;
}) {
  const fetchData = useCallback(
    () => api.periodHistory({ period, anchor }),
    [api, period, anchor],
  );
  const { data, error, reload } = useRemote(fetchData);
  if (error) return <Notice message={error} onRetry={reload} />;
  if (!data) return <Loading label="サマリーを読み込み中…" />;
  return (
    <View style={styles.results}>
      <View style={styles.totals}>
        <View style={styles.total}>
          <Text style={styles.caption}>記録日数</Text>
          <Text style={styles.totalValue}>
            {data.totals.loggedDays}
            <Text style={styles.unit}> 日</Text>
          </Text>
        </View>
        <View style={styles.total}>
          <Text style={styles.caption}>1日平均 kcal</Text>
          <Text style={styles.totalValue}>
            {data.totals.averageKcal?.toLocaleString('ja-JP') ?? '—'}
          </Text>
        </View>
        <View style={styles.total}>
          <Text style={styles.caption}>確定した寄付</Text>
          <Text style={styles.totalValue}>
            {formatYen(data.totals.donationYen)}
          </Text>
          {data.totals.pendingYen > 0 && (
            <Text style={styles.caption}>
              確定待ち {formatYen(data.totals.pendingYen)}
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.caption}>
        平均は記録のある日のみ。
        {data.granularity === 'month'
          ? '月を選ぶと日別の記録を表示します。'
          : '今日までの記録を表示しています。'}
      </Text>
      {data.granularity === 'month'
        ? data.months.map((item) => (
            <Pressable
              key={item.month}
              accessibilityRole="button"
              accessibilityLabel={`${Number(item.month.slice(5))}月、${item.loggedDays}日記録${item.status === 'future' ? '、未到来' : ''}`}
              accessibilityState={{ disabled: item.status === 'future' }}
              disabled={item.status === 'future'}
              onPress={() => onMonth(item.month)}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.pressed,
                item.status === 'future' && styles.future,
              ]}
            >
              <View style={styles.rowTop}>
                <Text style={styles.date}>{Number(item.month.slice(5))}月</Text>
                <Text style={styles.amount}>
                  {item.loggedDays ? formatYen(item.donationYen) : '—'}
                </Text>
              </View>
              <View style={styles.rowTop}>
                <Text style={styles.caption}>
                  {item.status === 'future'
                    ? '未到来'
                    : item.loggedDays === 0
                      ? '記録なし'
                      : `${item.loggedDays}日記録 · 平均 ${formatKcal(item.averageKcal!)}`}
                </Text>
                {item.status === 'partial' && (
                  <Badge label="集計中" tone="primary" />
                )}
              </View>
              {item.pendingYen > 0 && (
                <Text style={styles.caption}>
                  確定待ち {formatYen(item.pendingYen)}
                </Text>
              )}
            </Pressable>
          ))
        : data.days.map((item) => (
            <Pressable
              key={item.date}
              accessibilityRole="button"
              accessibilityLabel={`${formatDateLabel(item.date, data.today)}、${item.mealCount ? formatKcal(item.consumedKcal) : '記録なし'}、${item.status === 'settled' ? '確定' : '暫定'}`}
              onPress={() => onSelectDay(item.date)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowTop}>
                <Text style={styles.date}>
                  {formatDateLabel(item.date, data.today)}
                </Text>
                <Badge
                  label={item.status === 'settled' ? '確定' : '暫定'}
                  tone={item.status === 'settled' ? 'neutral' : 'primary'}
                />
              </View>
              <View style={styles.rowTop}>
                <Text
                  style={[styles.caption, item.overKcal > 0 && styles.over]}
                >
                  {item.mealCount ? formatKcal(item.consumedKcal) : '記録なし'}
                </Text>
                <Text style={[styles.amount, item.overKcal > 0 && styles.over]}>
                  {item.donationYen > 0 ? formatYen(item.donationYen) : '—'}
                </Text>
              </View>
            </Pressable>
          ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 16,
    borderTopWidth: 4,
    borderTopColor: colors.text,
    paddingTop: 24,
  },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontWeight: '800',
    fontSize: 17,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  picker: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  yearInput: { flex: 2 },
  monthInput: { flex: 1 },
  results: { gap: 12 },
  totals: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  total: { flex: 1, gap: 8 },
  totalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 12, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 19, flexShrink: 1 },
  row: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 18,
    gap: 8,
    minHeight: 76,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  date: { color: colors.text, fontSize: 16, fontWeight: '800' },
  amount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pressed: { opacity: 0.65 },
  over: { color: colors.over },
  future: { opacity: 0.55 },
});
