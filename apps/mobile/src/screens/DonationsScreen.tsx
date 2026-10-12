import { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  formatDateLabel,
  formatKcal,
  formatYen,
  type ApiClient,
  type Profile,
} from '@calorie-donate/api';
import { Card, Loading, Notice, SectionTitle } from '../components';
import { useRemote } from '../useRemote';
import { colors, radius } from '../theme';

export function DonationsScreen({
  api,
  profile,
  today,
}: {
  api: ApiClient;
  profile: Profile;
  today: string;
}) {
  const fetchLedger = useCallback(() => api.donations(), [api]);
  const {
    data: ledger,
    error,
    refreshing,
    reload,
    refresh,
  } = useRemote(fetchLedger);

  const rate = profile.donationYenPer100Kcal;
  const entries = ledger
    ? [...ledger.entries].sort((a, b) => b.date.localeCompare(a.date))
    : [];

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
      <Text style={styles.title} accessibilityRole="header">
        寄付
      </Text>
      {error ? <Notice message={error} onRetry={reload} /> : null}
      {!ledger ? (
        error ? null : (
          <Loading />
        )
      ) : (
        <>
          <View style={styles.hero} accessible>
            <Text style={styles.heroLabel}>これまでの寄付額（確定）</Text>
            <Text style={styles.heroValue}>
              {formatYen(ledger.totals.totalYen)}
            </Text>
            <Text style={styles.heroSub}>
              {ledger.totals.daysOver}日間で合計{' '}
              {formatKcal(ledger.totals.totalOverKcal)} 超過
            </Text>
            {ledger.totals.pendingYen > 0 ? (
              <Text style={styles.heroPending}>
                ＋ 暫定 {formatYen(ledger.totals.pendingYen)}（今日・昨日の分）
              </Text>
            ) : null}
          </View>

          <Card>
            <SectionTitle>寄付のしくみ</SectionTitle>
            <Text style={styles.body}>
              1日の目標 {formatKcal(profile.dailyTargetKcal)} を超えた分が、 100
              kcal ごとに {formatYen(rate)}{' '}
              の寄付になります（1円未満切り捨て）。
            </Text>
            <Text style={styles.example}>
              例: 目標を 250 kcal 超えた日 →{' '}
              {formatYen(Math.floor((250 * rate) / 100))}
            </Text>
            <Text style={styles.body}>
              今日と昨日の分は記録を修正できるため「暫定」です。それより前の日は確定し、下の台帳に記録されます。
              寄付は支援を必要とする子どもたちのために使われます。
            </Text>
          </Card>

          <SectionTitle>寄付台帳</SectionTitle>
          {entries.length === 0 ? (
            <Card style={styles.empty}>
              <Text style={styles.emptyText}>
                確定した寄付はまだありません。
              </Text>
            </Card>
          ) : (
            <Card style={styles.ledger}>
              {entries.map((entry, index) => (
                <View
                  key={entry.date}
                  style={[styles.entry, index > 0 && styles.entryBorder]}
                  accessible
                  accessibilityLabel={`${formatDateLabel(entry.date, today)}、${formatKcal(entry.overKcal)} 超過、寄付 ${formatYen(entry.donationYen)}`}
                >
                  <View style={styles.entryMain}>
                    <Text style={styles.entryDate}>
                      {formatDateLabel(entry.date, today)}
                    </Text>
                    <Text style={styles.entrySub}>
                      {entry.consumedKcal.toLocaleString('ja-JP')} /{' '}
                      {formatKcal(entry.targetKcal)}・
                      {formatKcal(entry.overKcal)} 超過・
                      {formatYen(entry.donationYenPer100Kcal)}/100kcal
                    </Text>
                  </View>
                  <Text style={styles.entryYen}>
                    {formatYen(entry.donationYen)}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 28, paddingBottom: 40 },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: 22,
    gap: 4,
  },
  heroLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  heroValue: { color: colors.text, fontSize: 40, fontWeight: '800' },
  heroSub: { color: colors.text, fontSize: 13 },
  heroPending: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  body: { color: colors.text, fontSize: 14, lineHeight: 22 },
  example: {
    color: colors.accentText,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  empty: { alignItems: 'center' },
  emptyText: { color: colors.muted, fontSize: 14 },
  ledger: { gap: 0, paddingVertical: 6 },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  entryBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  entryMain: { flex: 1, gap: 2 },
  entryDate: { color: colors.text, fontSize: 15, fontWeight: '700' },
  entrySub: { color: colors.muted, fontSize: 12 },
  entryYen: { color: colors.accentText, fontSize: 17, fontWeight: '800' },
});
