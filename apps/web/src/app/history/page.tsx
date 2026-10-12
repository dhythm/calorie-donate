'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ApiClientError,
  formatDateLabel,
  formatKcal,
  formatYen,
  progressRatio,
  type History,
} from '@calorie-donate/api';
import { LoadError, Loading, NeedsProfile } from '@/components/PageState';
import { api, errorMessage } from '@/lib/api';

const DAYS = 30;

export default function HistoryPage() {
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setHistory(await api.history(DAYS));
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
  if (!history) return <Loading />;

  const today = history.days[0]?.date ?? '';
  const logged = history.days.filter((day) => day.consumedKcal > 0);
  const achieved = logged.filter((day) => day.overKcal === 0).length;

  return (
    <div className="stack">
      <h1>履歴</h1>
      <section className="stats" aria-label={`直近${DAYS}日のまとめ`}>
        <div className="stat">
          <span className="stat-label">記録した日</span>
          <span className="stat-value">{logged.length} 日</span>
        </div>
        <div className="stat">
          <span className="stat-label">目標達成</span>
          <span className="stat-value">{achieved} 日</span>
        </div>
        <div className="stat">
          <span className="stat-label">寄付（確定+暫定）</span>
          <span className="stat-value">
            {formatYen(
              history.days.reduce((sum, day) => sum + day.donationYen, 0),
            )}
          </span>
        </div>
      </section>
      <ul className="history-list card">
        {history.days.map((day) => (
          <li key={day.date}>
            <Link
              href={day.date === today ? '/' : `/?date=${day.date}`}
              className="history-row"
              data-over={day.overKcal > 0}
            >
              <span className="history-date">
                {formatDateLabel(day.date, today)}
              </span>
              <span className="bar" aria-hidden="true">
                <span
                  className="bar-fill"
                  style={{
                    width: `${progressRatio(day.consumedKcal, day.targetKcal) * 100}%`,
                  }}
                />
              </span>
              <span className="history-kcal">
                {day.consumedKcal > 0
                  ? `${day.consumedKcal.toLocaleString('ja-JP')} / ${formatKcal(day.targetKcal)}`
                  : '記録なし'}
              </span>
              <span className="history-donation">
                {day.donationYen > 0 ? formatYen(day.donationYen) : '—'}
                <span className={`pill ${day.status}`}>
                  {day.status === 'settled' ? '確定' : '暫定'}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
