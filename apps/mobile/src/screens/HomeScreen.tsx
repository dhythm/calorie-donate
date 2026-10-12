import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  addDays,
  formatDateLabel,
  formatKcal,
  formatYen,
  mealTypeLabels,
  mealTypes,
  progressRatio,
  type ApiClient,
  type DayDetail,
  type Meal,
  type Overview,
} from '@calorie-donate/api';
import {
  Badge,
  Button,
  Card,
  Loading,
  Notice,
  ProgressBar,
  SectionTitle,
  Segmented,
} from '../components';
import { describeError } from '../errors';
import { useRemote } from '../useRemote';
import { colors, radius } from '../theme';

export function HomeScreen({
  api,
  today,
  date,
  onSelectDate,
  onAddMeal,
  onEditMeal,
  onOverview,
  onApiError,
  onOpenHistory,
}: {
  api: ApiClient;
  today: string;
  date: string;
  onSelectDate: (date: string) => void;
  onAddMeal: (date: string) => void;
  onEditMeal: (meal: Meal) => void;
  onOverview: (overview: Overview) => void;
  onApiError: (error: unknown) => void;
  onOpenHistory: () => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fetchOverview = useCallback(async () => {
    try {
      const result = await api.overview(date);
      onOverview(result);
      return result;
    } catch (caught) {
      onApiError(caught);
      throw caught;
    }
  }, [api, date, onOverview, onApiError]);
  const {
    data: overview,
    error,
    refreshing,
    reload,
    refresh,
  } = useRemote(fetchOverview);

  function confirmDelete(meal: Meal) {
    Alert.alert('食事を削除', `「${meal.name}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeletingId(meal.id);
            try {
              await api.deleteMeal(meal.id);
              reload();
            } catch (caught) {
              Alert.alert('削除できませんでした', describeError(caught));
              onApiError(caught);
            } finally {
              setDeletingId(null);
            }
          })();
        },
      },
    ]);
  }

  const yesterday = addDays(today, -1);
  const day = overview?.day && overview.day.date === date ? overview.day : null;
  const totals = overview?.totals ?? null;
  const isOlder = date !== today && date !== yesterday;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.text}
          colors={[colors.text]}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {overview?.profile?.displayName
            ? `${overview.profile.displayName}さんの記録`
            : 'きょうの記録'}
        </Text>
      </View>
      <Segmented
        label="表示する日"
        value={
          date === today ? 'today' : date === yesterday ? 'yesterday' : 'older'
        }
        onChange={(value) => {
          if (value === 'today') onSelectDate(today);
          else if (value === 'yesterday') onSelectDate(yesterday);
          else onOpenHistory();
        }}
        options={[
          { value: 'today', label: '今日' },
          { value: 'yesterday', label: '昨日' },
          {
            value: 'older',
            label: isOlder ? formatDateLabel(date, today) : 'それ以前',
          },
        ]}
      />
      {error && !day ? (
        <Notice message={error} onRetry={reload} />
      ) : !day ? (
        <Loading />
      ) : (
        <>
          {error ? <Notice message={error} onRetry={reload} /> : null}
          <DayCard day={day} today={today} />
          {totals ? (
            <View style={styles.totalsRow}>
              <Card style={styles.totalCard}>
                <Text style={styles.totalLabel}>累計寄付額</Text>
                <Text style={styles.totalValue}>
                  {formatYen(totals.totalYen)}
                </Text>
                <Text style={styles.totalSub}>{totals.daysOver}日分の超過</Text>
              </Card>
              <Card style={styles.totalCard}>
                <Text style={styles.totalLabel}>暫定（未確定）</Text>
                <Text style={[styles.totalValue, styles.pendingValue]}>
                  {formatYen(totals.pendingYen)}
                </Text>
                <Text style={styles.totalSub}>今日・昨日の分</Text>
              </Card>
            </View>
          ) : null}
          <View style={styles.mealsHeader}>
            <SectionTitle>食事</SectionTitle>
            {day.editable ? (
              <Button
                title="＋ 食事を追加"
                compact
                onPress={() => onAddMeal(date)}
                accessibilityLabel={`${formatDateLabel(date, today)}の食事を追加`}
              />
            ) : (
              <Badge label="確定済み・閲覧のみ" />
            )}
          </View>
          <MealList
            day={day}
            photoUrl={api.photoUrl}
            deletingId={deletingId}
            onEdit={onEditMeal}
            onDelete={confirmDelete}
            onAdd={() => onAddMeal(date)}
          />
        </>
      )}
    </ScrollView>
  );
}

function DayCard({ day, today }: { day: DayDetail; today: string }) {
  const over = day.overKcal > 0;
  const settled = day.status === 'settled';
  const label = formatDateLabel(day.date, today);
  return (
    <Card style={over ? styles.dayCardOver : undefined}>
      <View style={styles.dayCardTop}>
        <Text style={styles.dayLabel}>{label}</Text>
        <Badge
          label={settled ? '確定' : '暫定'}
          tone={settled ? 'neutral' : 'primary'}
        />
      </View>
      <View style={styles.bigRow}>
        <Text
          style={[styles.bigNumber, over && styles.overText]}
          accessibilityLabel={`摂取 ${formatKcal(day.consumedKcal)}、目標 ${formatKcal(day.targetKcal)}`}
        >
          {day.consumedKcal.toLocaleString('ja-JP')}
        </Text>
        <Text style={styles.bigTarget}>/ {formatKcal(day.targetKcal)}</Text>
      </View>
      <ProgressBar
        ratio={progressRatio(day.consumedKcal, day.targetKcal)}
        over={over}
        height={14}
        label="目標カロリーに対する摂取量"
      />
      {over ? (
        <Text style={[styles.status, styles.overText]}>
          {formatKcal(day.overKcal)} 超過
        </Text>
      ) : (
        <Text style={styles.status}>あと {formatKcal(day.remainingKcal)}</Text>
      )}
      {over ? (
        <View style={styles.donationBox}>
          <Text style={styles.donationText}>
            {settled
              ? `${formatYen(day.donationYen)} を寄付しました`
              : `このままだと ${formatYen(day.donationYen)} を寄付`}
          </Text>
          <Text style={styles.donationSub}>
            100 kcal 超過ごとに {formatYen(day.donationYenPer100Kcal)}
          </Text>
        </View>
      ) : (
        <Text style={styles.donationSub}>
          目標内なら寄付は発生しません。超過 100 kcal ごとに
          {formatYen(day.donationYenPer100Kcal)} が寄付されます。
        </Text>
      )}
    </Card>
  );
}

function MealList({
  day,
  photoUrl,
  deletingId,
  onEdit,
  onDelete,
  onAdd,
}: {
  day: DayDetail;
  photoUrl: (id: string) => string;
  deletingId: string | null;
  onEdit: (meal: Meal) => void;
  onDelete: (meal: Meal) => void;
  onAdd: () => void;
}) {
  if (day.meals.length === 0) {
    return (
      <Card style={styles.empty}>
        <Text style={styles.emptyText}>まだ記録がありません</Text>
        {day.editable ? (
          <Button
            title="写真または手入力で記録"
            variant="secondary"
            onPress={onAdd}
          />
        ) : null}
      </Card>
    );
  }
  return (
    <View style={styles.groups}>
      {mealTypes.map((type) => {
        const meals = day.meals.filter((meal) => meal.mealType === type);
        if (meals.length === 0) return null;
        const subtotal = meals.reduce((sum, meal) => sum + meal.calories, 0);
        return (
          <Card key={type} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{mealTypeLabels[type]}</Text>
              <Text style={styles.groupTotal}>{formatKcal(subtotal)}</Text>
            </View>
            {meals.map((meal) => (
              <View key={meal.id} style={styles.meal}>
                {meal.photoId ? (
                  <Image
                    source={{ uri: photoUrl(meal.photoId) }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                    accessibilityLabel={`${meal.name}の写真`}
                  />
                ) : null}
                <View style={styles.mealMain}>
                  <View style={styles.mealTitleRow}>
                    <Text style={styles.mealName} numberOfLines={2}>
                      {meal.name}
                    </Text>
                    {meal.source === 'photo' ? (
                      <Badge label="写真" tone="primary" />
                    ) : null}
                  </View>
                  {meal.items.length > 0 ? (
                    <Text style={styles.mealItems} numberOfLines={2}>
                      {meal.items
                        .map((item) => `${item.name} ${item.calories}`)
                        .join('・')}
                    </Text>
                  ) : null}
                  {meal.note ? (
                    <Text style={styles.mealNote}>{meal.note}</Text>
                  ) : null}
                </View>
                <Text style={styles.mealKcal}>{formatKcal(meal.calories)}</Text>
                {day.editable ? (
                  <View style={styles.mealActions}>
                    <Button
                      title="編集"
                      compact
                      variant="ghost"
                      onPress={() => onEdit(meal)}
                      accessibilityLabel={`${meal.name}を編集`}
                    />
                    <Button
                      title="削除"
                      compact
                      variant="danger"
                      loading={deletingId === meal.id}
                      onPress={() => onDelete(meal)}
                      accessibilityLabel={`${meal.name}を削除`}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 28, paddingBottom: 40 },
  header: { gap: 4 },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  dayCardOver: { borderColor: colors.over },
  dayCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayLabel: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bigNumber: {
    color: colors.text,
    fontSize: 48,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bigTarget: { color: colors.muted, fontSize: 18, fontWeight: '600' },
  status: { color: colors.text, fontSize: 18, fontWeight: '700' },
  overText: { color: colors.over },
  donationBox: {
    backgroundColor: colors.overSoft,
    borderRadius: radius.md,
    padding: 12,
    gap: 2,
  },
  donationText: { color: colors.over, fontSize: 17, fontWeight: '800' },
  donationSub: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  totalsRow: { flexDirection: 'row', gap: 12 },
  totalCard: { flex: 1, gap: 4, padding: 14 },
  totalLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  totalValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  pendingValue: { color: colors.accent },
  totalSub: { color: colors.muted, fontSize: 11 },
  mealsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  groups: { gap: 12 },
  group: { gap: 8, paddingVertical: 14 },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  groupTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  groupTotal: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  meal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  mealMain: { flex: 1, minWidth: 140, gap: 2 },
  mealTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mealName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  mealItems: { color: colors.muted, fontSize: 12 },
  mealNote: { color: colors.muted, fontSize: 12, fontStyle: 'italic' },
  mealKcal: { color: colors.text, fontSize: 15, fontWeight: '700' },
  mealActions: { flexDirection: 'row', gap: 6 },
  empty: { alignItems: 'center', paddingVertical: 28 },
  emptyText: { color: colors.muted, fontSize: 15 },
});
