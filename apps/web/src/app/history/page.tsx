'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ApiClientError,
  formatDateLabel,
  formatKcal,
  formatYen,
  progressRatio,
  type HabitStats,
  type History,
} from '@calorie-donate/api';
import {
  DailyChart,
  HabitCalendar,
  MealTypeChart,
  WeekdayChart,
} from '@/components/HabitCharts';
import { LoadError, Loading, NeedsProfile } from '@/components/PageState';
import { api, errorMessage } from '@/lib/api';

const DAYS = 30;
/** Twelve weeks for the habit calendar and averages. */
const STATS_DAYS = 84;

export default function HistoryPage() {
  const [history, setHistory] = useState<History | null>(null);
  const [stats, setStats] = useState<HabitStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextHistory, nextStats] = await Promise.all([
        api.history(DAYS),
        api.stats(STATS_DAYS),
      ]);
      setHistory(nextHistory);
      setStats(nextStats);
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
  if (!history || !stats) return <Loading />;

  const today = history.days[0]?.date ?? '';
  const { streaks, summary } = stats;
  const target = stats.days.at(-1)?.targetKcal ?? 0;

  return (
    <div className="stack">
      <h1>グラフ</h1>
      <section
        className="stats four"
        aria-label={`直近${STATS_DAYS}日のまとめ`}
      >
        <div className="stat">
          <span className="stat-label">記録の連続日数</span>
          <span className="stat-value" data-testid="logging-streak">
            {streaks.currentLogging} 日
          </span>
          <span className="stat-sub">最長 {streaks.bestLogging} 日</span>
        </div>
        <div className="stat">
          <span className="stat-label">目標内の連続日数</span>
          <span className="stat-value">{streaks.currentWithinTarget} 日</span>
          <span className="stat-sub">最長 {streaks.bestWithinTarget} 日</span>
        </div>
        <div className="stat">
          <span className="stat-label">目標達成率</span>
          <span className="stat-value">
            {Math.round(summary.achievementRate * 100)}%
          </span>
          <span className="stat-sub">
            {summary.withinTargetDays} / {summary.loggedDays} 日
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">平均摂取</span>
          <span className="stat-value">
            {summary.averageKcal.toLocaleString('ja-JP')}
          </span>
          <span className="stat-sub">kcal / 記録した日</span>
        </div>
      </section>
      <section className="card">
        <DailyChart stats={stats} />
      </section>
      <section className="card">
        <HabitCalendar stats={stats} />
      </section>
      <div className="chart-grid">
        <section className="card">
          <WeekdayChart stats={stats} target={target} />
        </section>
        <section className="card">
          <MealTypeChart stats={stats} />
        </section>
      </div>
      <h2>日ごとの記録</h2>
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
