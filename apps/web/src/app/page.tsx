'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import {
  addDays,
  formatDateLabel,
  formatKcal,
  formatYen,
  type Meal,
  type Overview,
} from '@calorie-donate/api';
import { MealList } from '@/components/MealList';
import { Onboarding } from '@/components/Onboarding';
import { ProgressRing } from '@/components/ProgressRing';
import { api, errorMessage } from '@/lib/api';

export default function HomePage() {
  return (
    <Suspense fallback={<p className="loading">読み込み中…</p>}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const router = useRouter();
  const date = useSearchParams().get('date') ?? undefined;
  const setDate = (next: string, today: string) =>
    router.replace(next === today ? '/' : `/?date=${next}`);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (target?: string) => {
    setError(null);
    try {
      setOverview(await api.overview(target));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    // Fetch on mount and whenever the viewed day changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(date);
  }, [date, load]);

  async function remove(meal: Meal) {
    if (!window.confirm(`「${meal.name}」を削除しますか？`)) return;
    try {
      await api.deleteMeal(meal.id);
      await load(date);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  if (error && !overview) {
    return (
      <div className="card state-message">
        <p role="alert" className="notice error">
          {error}
        </p>
        <button className="button" onClick={() => void load(date)}>
          再読み込み
        </button>
      </div>
    );
  }
  if (!overview) {
    return (
      <p className="loading" aria-busy="true">
        読み込み中…
      </p>
    );
  }
  if (!overview.profile || !overview.day || !overview.totals) {
    return <Onboarding onDone={() => void load()} />;
  }

  const { today, profile, day, totals } = overview;
  const over = day.overKcal > 0;
  const isToday = day.date === today;
  const query = `?date=${day.date}`;

  return (
    <div className="stack dashboard">
      <div className="day-switch">
        <button
          type="button"
          className="icon-button"
          onClick={() => setDate(addDays(day.date, -1), today)}
          aria-label="前の日"
        >
          ‹
        </button>
        <h1>
          {formatDateLabel(day.date, today)}
          <span className="day-date">{day.date}</span>
        </h1>
        <button
          type="button"
          className="icon-button"
          onClick={() => setDate(addDays(day.date, 1), today)}
          disabled={isToday}
          aria-label="次の日"
        >
          ›
        </button>
      </div>

      <section className="card hero" data-over={over}>
        <ProgressRing
          consumedKcal={day.consumedKcal}
          targetKcal={day.targetKcal}
        />
        <div className="hero-body">
          {profile.displayName && (
            <p className="hint">{profile.displayName} さんの記録</p>
          )}
          <p className="hero-status" data-testid="day-status">
            {over
              ? `目標を ${formatKcal(day.overKcal)} 超過`
              : `あと ${formatKcal(day.remainingKcal)} 食べられます`}
          </p>
          <p className="donation-line" data-testid="day-donation">
            {day.status === 'settled'
              ? over
                ? `この日は ${formatYen(day.donationYen)} を寄付しました`
                : 'この日は目標達成。寄付はありません'
              : over
                ? `このままだと ${formatYen(day.donationYen)} を寄付します`
                : '目標内なら寄付は発生しません'}
          </p>
          <span className={`pill ${day.status}`}>
            {day.status === 'settled' ? '確定済み' : '記録受付中'}
          </span>
        </div>
      </section>

      {day.editable && (
        <div className="actions">
          <Link
            href={`/meals/new${query}&mode=photo`}
            className="button primary"
          >
            写真で記録
          </Link>
          <Link href={`/meals/new${query}`} className="button">
            手入力で記録
          </Link>
        </div>
      )}

      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}

      <section className="card meal-section">
        <h2>食事の記録</h2>
        {!day.editable && (
          <p className="hint">
            確定済みの日は変更できません。記録・修正できるのは今日と昨日です。
          </p>
        )}
        <MealList meals={day.meals} editable={day.editable} onDelete={remove} />
      </section>

      <section className="stats" aria-label="寄付の状況">
        <Link href="/donations" className="stat">
          <span className="stat-label">累計寄付額</span>
          <span className="stat-value" data-testid="total-donation">
            {formatYen(totals.totalYen)}
          </span>
        </Link>
        <div className="stat">
          <span className="stat-label">確定待ち</span>
          <span className="stat-value">{formatYen(totals.pendingYen)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">超過した日</span>
          <span className="stat-value">{totals.daysOver} 日</span>
        </div>
      </section>
    </div>
  );
}
