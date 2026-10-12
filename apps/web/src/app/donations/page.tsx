'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  ApiClientError,
  formatDateLabel,
  formatKcal,
  formatYen,
  type DonationLedger,
} from '@calorie-donate/api';
import { LoadError, Loading, NeedsProfile } from '@/components/PageState';
import { useOverview } from '@/components/useOverview';
import { api, errorMessage } from '@/lib/api';

export default function DonationsPage() {
  const { overview } = useOverview();
  const [ledger, setLedger] = useState<DonationLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setLedger(await api.donations());
    } catch (caught) {
      if (
        caught instanceof ApiClientError &&
        caught.code === 'PROFILE_REQUIRED'
      ) {
        setNeedsProfile(true);
      } else {
        setError(errorMessage(caught));
      }
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (needsProfile) return <NeedsProfile />;
  if (error) return <LoadError message={error} onRetry={() => void load()} />;
  if (!ledger) return <Loading />;

  const { totals, entries } = ledger;
  const rate = overview?.profile?.donationYenPer100Kcal;
  return (
    <div className="stack">
      <h1>寄付</h1>
      <section className="card donation-hero">
        <p className="stat-label">これまでの寄付額</p>
        <p className="donation-total" data-testid="ledger-total">
          {formatYen(totals.totalYen)}
        </p>
        <p className="hint">
          超過カロリー合計 {formatKcal(totals.totalOverKcal)}・{totals.daysOver}{' '}
          日分
          {totals.pendingYen > 0 &&
            `／確定待ち ${formatYen(totals.pendingYen)}`}
        </p>
      </section>

      <section className="card">
        <h2>しくみ</h2>
        <ul className="explain">
          <li>
            1日の摂取カロリーが目標を超えると、超えた分が寄付の対象になります。
          </li>
          <li>
            寄付額は「超過 kcal ÷ 100 × レート」（円未満切り捨て）です。
            {rate !== undefined &&
              ` 現在のレートは 100 kcal ごとに ${formatYen(rate)}。`}
          </li>
          <li>
            記録・修正できるのは今日と昨日まで。それより前の日は自動で確定し、確定時のレートで寄付額が記録されます。
          </li>
          <li>現在は寄付額の記録のみで、実際の決済・送金は行いません。</li>
        </ul>
      </section>

      <section className="card">
        <h2>寄付の記録</h2>
        {entries.length === 0 ? (
          <p className="empty">まだ確定した寄付はありません。</p>
        ) : (
          <ul className="ledger">
            {entries.map((entry) => (
              <li key={entry.date} className="ledger-row">
                <span>
                  <strong>
                    {overview
                      ? formatDateLabel(entry.date, overview.today)
                      : entry.date}
                  </strong>
                  <span className="hint">
                    {formatKcal(entry.consumedKcal)}（目標{' '}
                    {formatKcal(entry.targetKcal)}、+
                    {formatKcal(entry.overKcal)}）
                  </span>
                </span>
                <span className="ledger-amount">
                  {formatYen(entry.donationYen)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
