import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addDays,
  formatDateLabel,
  formatKcal,
  formatYen,
  mealTypeLabels,
  mealTypes,
  weekdayLabels,
  type HabitDay,
  type HabitStats,
} from '@calorie-donate/api';
import { Card, SectionTitle } from './components';
import { colors, radius } from './theme';

/** Data colors: only for marks (bars, cells, swatches), never for text. */
const WITHIN = colors.chartWithin;
const OVER = colors.chartOver;
const NO_LOG = colors.border;

const CHART_DAYS = 30;
const CHART_HEIGHT = 140;
const CALENDAR_WEEKS = 12;
const CELL = 14;
const CELL_GAP = 3;
/** Monday first, Sunday last. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type DayState = 'within' | 'over' | 'none';

function dayState(day: HabitDay): DayState {
  if (day.mealCount === 0) return 'none';
  return day.overKcal > 0 ? 'over' : 'within';
}

const stateColor: Record<DayState, string> = {
  within: WITHIN,
  over: OVER,
  none: NO_LOG,
};

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function shortDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${Number(month)}/${Number(day)}`;
}

/** Parts describing one day, shared by captions and screen reader labels. */
function describeDay(day: HabitDay, today: string): string[] {
  const parts = [formatDateLabel(day.date, today)];
  if (day.mealCount === 0) return [...parts, '記録なし'];
  parts.push(formatKcal(day.consumedKcal));
  if (day.overKcal > 0) {
    parts.push(`${formatKcal(day.overKcal)} 超過`);
    parts.push(`寄付 ${formatYen(day.donationYen)}`);
  } else {
    parts.push('目標以内');
  }
  return parts;
}

function DayCaption({
  day,
  today,
  hint,
}: {
  day: HabitDay | null;
  today: string;
  hint: string;
}) {
  return (
    <Text style={styles.caption} accessibilityLiveRegion="polite">
      {day ? describeDay(day, today).join(' ・ ') : hint}
    </Text>
  );
}

function Legend({
  items,
}: {
  items: { label: string; color?: string; kind?: 'swatch' | 'line' | 'ring' }[];
}) {
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View
            style={[
              item.kind === 'line'
                ? styles.legendLine
                : item.kind === 'ring'
                  ? styles.legendRing
                  : styles.legendSwatch,
              item.color ? { backgroundColor: item.color } : null,
            ]}
          />
          <Text style={styles.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function StatTiles({ stats }: { stats: HabitStats }) {
  const { streaks, summary } = stats;
  const tiles = [
    {
      label: '記録の連続日数',
      value: `${streaks.currentLogging}日`,
      sub: `最長 ${streaks.bestLogging} 日`,
    },
    {
      label: '目標内の連続日数',
      value: `${streaks.currentWithinTarget}日`,
      sub: `最長 ${streaks.bestWithinTarget} 日`,
    },
    {
      label: '目標達成率',
      value: `${Math.round(summary.achievementRate * 100)}%`,
      sub: `${summary.withinTargetDays}/${summary.loggedDays} 日`,
    },
    {
      label: '平均摂取',
      value: formatKcal(summary.averageKcal),
      sub: `記録した${summary.loggedDays}日の平均`,
    },
  ];
  return (
    <View style={styles.tiles}>
      {tiles.map((tile) => (
        <View
          key={tile.label}
          style={styles.tile}
          accessible
          accessibilityLabel={`${tile.label} ${tile.value}、${tile.sub}`}
        >
          <Text style={styles.tileLabel}>{tile.label}</Text>
          <Text style={styles.tileValue}>{tile.value}</Text>
          <Text style={styles.tileSub}>{tile.sub}</Text>
        </View>
      ))}
    </View>
  );
}

export function DailyChart({ stats }: { stats: HabitStats }) {
  const [selected, setSelected] = useState<string | null>(null);
  const days = stats.days.slice(-CHART_DAYS);
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last) return null;
  const target = last.targetKcal;
  const scale =
    Math.max(target, ...days.map((day) => day.consumedKcal), 1) * 1.15;
  const targetBottom = (target / scale) * CHART_HEIGHT;
  const selectedDay = days.find((day) => day.date === selected) ?? null;

  return (
    <Card>
      <SectionTitle>毎日の摂取カロリー</SectionTitle>
      <Text style={styles.sectionSub}>直近{CHART_DAYS}日間</Text>
      <View style={styles.chart}>
        <View style={styles.columns}>
          {days.map((day) => {
            const state = dayState(day);
            const isSelected = day.date === selected;
            return (
              <Pressable
                key={day.date}
                accessibilityRole="button"
                accessibilityLabel={`${describeDay(day, stats.today).join('、')}、目標 ${formatKcal(day.targetKcal)}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelected(isSelected ? null : day.date)}
                style={[styles.slot, isSelected && styles.slotSelected]}
              >
                {state === 'none' ? null : (
                  <View
                    style={[
                      styles.column,
                      {
                        height: Math.max(
                          2,
                          (day.consumedKcal / scale) * CHART_HEIGHT,
                        ),
                        backgroundColor: stateColor[state],
                      },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.targetLine, { bottom: targetBottom }]} />
        <Text
          accessible={false}
          style={[styles.targetLabel, { bottom: targetBottom + 3 }]}
        >
          目標 {target.toLocaleString('ja-JP')}
        </Text>
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{shortDate(first.date)}</Text>
        <Text style={styles.axisText}>{shortDate(last.date)}</Text>
      </View>
      <DayCaption
        day={selectedDay}
        today={stats.today}
        hint="棒をタップするとその日の詳細を表示します"
      />
      <Legend
        items={[
          { label: '目標以内', color: WITHIN },
          { label: '目標超過', color: OVER },
          { label: '目標', kind: 'line' },
        ]}
      />
    </Card>
  );
}

export function HabitCalendar({ stats }: { stats: HabitStats }) {
  const [selected, setSelected] = useState<string | null>(null);
  const byDate = new Map(stats.days.map((day) => [day.date, day]));
  const lastSunday = addDays(stats.today, -weekdayOf(stats.today));
  const weeks = Array.from({ length: CALENDAR_WEEKS }, (_, index) =>
    addDays(lastSunday, (index - CALENDAR_WEEKS + 1) * 7),
  );
  const selectedDay = selected ? (byDate.get(selected) ?? null) : null;

  return (
    <Card>
      <SectionTitle>習慣カレンダー</SectionTitle>
      <Text style={styles.sectionSub}>直近{CALENDAR_WEEKS}週間</Text>
      <View style={styles.calendar}>
        <View style={styles.calendarColumn}>
          {weekdayLabels.map((label) => (
            <Text key={label} style={styles.calendarDayLabel}>
              {label}
            </Text>
          ))}
        </View>
        {weeks.map((sunday) => (
          <View key={sunday} style={styles.calendarColumn}>
            {weekdayLabels.map((_, weekday) => {
              const date = addDays(sunday, weekday);
              const day = byDate.get(date);
              if (!day || date > stats.today) {
                return <View key={date} style={styles.cell} />;
              }
              const isSelected = date === selected;
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={describeDay(day, stats.today).join('、')}
                  accessibilityState={{ selected: isSelected }}
                  hitSlop={1}
                  onPress={() => setSelected(isSelected ? null : date)}
                  style={[
                    styles.cell,
                    { backgroundColor: stateColor[dayState(day)] },
                    date === stats.today && styles.cellToday,
                    isSelected && styles.cellSelected,
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <DayCaption
        day={selectedDay}
        today={stats.today}
        hint="マスをタップするとその日の詳細を表示します"
      />
      <Legend
        items={[
          { label: '目標以内', color: WITHIN },
          { label: '目標超過', color: OVER },
          { label: '記録なし', color: NO_LOG },
          { label: '今日', kind: 'ring' },
        ]}
      />
    </Card>
  );
}

function BarRow({
  label,
  value,
  scale,
  marker,
  empty,
  accessibilityLabel,
}: {
  label: string;
  value: number;
  scale: number;
  marker?: number;
  empty: boolean;
  accessibilityLabel: string;
}) {
  return (
    <View
      style={styles.barRow}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.min(100, (value / scale) * 100)}%` },
          ]}
        />
        {marker !== undefined ? (
          <View
            style={[
              styles.barMarker,
              { left: `${Math.min(100, (marker / scale) * 100)}%` },
            ]}
          />
        ) : null}
      </View>
      <Text style={styles.barValue}>
        {empty ? '—' : value.toLocaleString('ja-JP')}
      </Text>
    </View>
  );
}

export function WeekdayBars({ stats }: { stats: HabitStats }) {
  const target = stats.days.at(-1)?.targetKcal ?? 0;
  const scale =
    Math.max(target, ...stats.weekdays.map((day) => day.averageKcal), 1) * 1.1;
  return (
    <Card>
      <SectionTitle>曜日ごとの平均</SectionTitle>
      <Text style={styles.sectionSub}>
        記録した日の平均（kcal）。縦線は目標 {formatKcal(target)}
      </Text>
      <View style={styles.bars}>
        {WEEKDAY_ORDER.map((weekday) => {
          const entry = stats.weekdays.find((day) => day.weekday === weekday);
          const average = entry?.averageKcal ?? 0;
          const logged = entry?.loggedDays ?? 0;
          const label = weekdayLabels[weekday] ?? '';
          return (
            <BarRow
              key={weekday}
              label={label}
              value={average}
              scale={scale}
              marker={target}
              empty={logged === 0}
              accessibilityLabel={
                logged === 0
                  ? `${label}曜日、記録なし`
                  : `${label}曜日、平均 ${formatKcal(average)}、${logged}日分、目標 ${formatKcal(target)}`
              }
            />
          );
        })}
      </View>
    </Card>
  );
}

export function MealTypeBars({ stats }: { stats: HabitStats }) {
  const scale =
    Math.max(...mealTypes.map((type) => stats.mealTypes[type]), 1) * 1.1;
  const empty = stats.summary.loggedDays === 0;
  return (
    <Card>
      <SectionTitle>食事ごとの平均</SectionTitle>
      <Text style={styles.sectionSub}>記録した日の1日あたり（kcal）</Text>
      <View style={styles.bars}>
        {mealTypes.map((type) => (
          <BarRow
            key={type}
            label={mealTypeLabels[type]}
            value={stats.mealTypes[type]}
            scale={scale}
            empty={empty}
            accessibilityLabel={`${mealTypeLabels[type]}、平均 ${formatKcal(stats.mealTypes[type])}`}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionSub: { color: colors.muted, fontSize: 12, marginTop: -6 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 2,
  },
  tileLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  tileValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  tileSub: { color: colors.muted, fontSize: 12 },
  chart: { height: CHART_HEIGHT, position: 'relative' },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  slot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 1,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  slotSelected: { backgroundColor: colors.surfaceMuted },
  column: {
    width: '100%',
    maxWidth: 16,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    pointerEvents: 'none',
    backgroundColor: colors.text,
  },
  targetLabel: {
    position: 'absolute',
    right: 0,
    pointerEvents: 'none',
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: colors.surface,
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { color: colors.muted, fontSize: 11 },
  caption: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    minHeight: 20,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendLine: { width: 14, height: 1.5, backgroundColor: colors.text },
  legendRing: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.text,
  },
  legendText: { color: colors.muted, fontSize: 12 },
  calendar: { flexDirection: 'row', gap: CELL_GAP },
  calendarColumn: { gap: CELL_GAP },
  calendarDayLabel: {
    height: CELL,
    lineHeight: CELL,
    fontSize: 10,
    color: colors.muted,
    width: 14,
    textAlign: 'center',
  },
  cell: { width: CELL, height: CELL, borderRadius: 4 },
  cellToday: { borderWidth: 2, borderColor: colors.text },
  cellSelected: { borderWidth: 2, borderColor: colors.muted },
  bars: { gap: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { color: colors.text, fontSize: 13, fontWeight: '600', width: 32 },
  barTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: NO_LOG,
    justifyContent: 'center',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 6,
    backgroundColor: WITHIN,
  },
  barMarker: {
    position: 'absolute',
    width: 2,
    height: 18,
    marginLeft: -1,
    backgroundColor: colors.text,
  },
  barValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    width: 52,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
