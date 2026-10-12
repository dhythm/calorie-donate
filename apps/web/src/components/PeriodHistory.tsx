'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  dateKeySchema,
  formatDateLabel,
  formatKcal,
  formatYen,
  historyPeriodLabel,
  historyPeriodRange,
  shiftHistoryPeriod,
  type HistoryPeriod,
  type PeriodHistory as HistoryData,
} from '@calorie-donate/api';
import { api, errorMessage } from '@/lib/api';

const periods: { value: HistoryPeriod; label: string; current: string }[] = [
  { value: 'week', label: '週', current: '今週' },
  { value: 'month', label: '月', current: '今月' },
  { value: 'year', label: '年', current: '今年' },
];

export function PeriodHistory({ today }: { today: string }) {
  const [period, setPeriod] = useState<HistoryPeriod>('week');
  const [anchor, setAnchor] = useState(today);
  const range = historyPeriodRange(period, anchor);
  const currentRange = historyPeriodRange(period, today);
  const next = shiftHistoryPeriod(period, anchor, 1);
  const currentLabel = periods.find((item) => item.value === period)!.current;
  const move = (amount: number) =>
    setAnchor(shiftHistoryPeriod(period, anchor, amount));

  return (
    <section
      className="period-history"
      aria-labelledby="period-history-title"
      data-testid="period-history"
    >
      <div className="period-heading">
        <div>
          <p className="eyebrow">HISTORY</p>
          <h2 id="period-history-title">記録サマリー</h2>
        </div>
        <div
          className="segmented period-tabs"
          role="group"
          aria-label="記録の表示単位"
        >
          {periods.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={period === item.value}
              onClick={() => setPeriod(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="period-navigation">
        <button
          type="button"
          className="icon-button"
          aria-label={`前の${periods.find((item) => item.value === period)!.label}`}
          onClick={() => move(-1)}
        >
          ‹
        </button>
        <strong aria-live="polite">{historyPeriodLabel(period, anchor)}</strong>
        <button
          type="button"
          className="icon-button"
          aria-label={`次の${periods.find((item) => item.value === period)!.label}`}
          disabled={historyPeriodRange(period, next).from > today}
          onClick={() => move(1)}
        >
          ›
        </button>
        <button
          type="button"
          className="link-button"
          disabled={range.from === currentRange.from}
          onClick={() => setAnchor(today)}
        >
          {currentLabel}に戻る
        </button>
      </div>
      <div className="period-picker">
        {period === 'year' ? (
          <form
            key={`year-${anchor}`}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const year = Number(form.get('year'));
              if (
                Number.isInteger(year) &&
                year >= 1 &&
                year <= Number(today.slice(0, 4))
              )
                setAnchor(`${String(year).padStart(4, '0')}-01-01`);
            }}
          >
            <label>
              表示年
              <input
                aria-label="表示年"
                name="year"
                type="number"
                min="1"
                max={Number(today.slice(0, 4))}
                defaultValue={Number(anchor.slice(0, 4))}
                required
              />
            </label>
            <button type="submit" className="button">
              移動
            </button>
          </form>
        ) : (
          <form
            key={`${period}-${anchor}`}
            onSubmit={(event) => {
              event.preventDefault();
              const value = String(
                new FormData(event.currentTarget).get('anchor'),
              );
              const date = period === 'month' ? `${value}-01` : value;
              if (dateKeySchema.safeParse(date).success && date <= today)
                setAnchor(date);
            }}
          >
            <label>
              {period === 'month' ? '表示月' : '週を選ぶ'}
              <input
                aria-label={period === 'month' ? '表示月' : '週を選ぶ'}
                type={period === 'month' ? 'month' : 'date'}
                name="anchor"
                max={period === 'month' ? today.slice(0, 7) : today}
                defaultValue={period === 'month' ? anchor.slice(0, 7) : anchor}
                required
              />
            </label>
            <button type="submit" className="button">
              移動
            </button>
          </form>
        )}
      </div>
      <PeriodResults
        key={`${period}/${anchor}/${today}`}
        period={period}
        anchor={anchor}
        onMonth={(month) => {
          setAnchor(`${month}-01`);
          setPeriod('month');
        }}
      />
    </section>
  );
}

function PeriodResults({
  period,
  anchor,
  onMonth,
}: {
  period: HistoryPeriod;
  anchor: string;
  onMonth: (month: string) => void;
}) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    api.periodHistory({ period, anchor }).then(
      (result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      },
      (caught) => {
        if (active) setError(errorMessage(caught));
      },
    );
    return () => {
      active = false;
    };
  }, [period, anchor, retry]);
  if (error)
    return (
      <div className="state-message">
        <p className="notice error" role="alert">
          {error}
        </p>
        <button
          className="button"
          type="button"
          onClick={() => {
            setError(null);
            setRetry((value) => value + 1);
          }}
        >
          再読み込み
        </button>
      </div>
    );
  if (!data)
    return (
      <p className="loading" aria-busy="true">
        サマリーを読み込み中…
      </p>
    );

  return (
    <>
      <dl className="period-totals">
        <div>
          <dt>記録日数</dt>
          <dd>
            {data.totals.loggedDays}
            <small> 日</small>
          </dd>
        </div>
        <div>
          <dt>1日平均</dt>
          <dd>
            {data.totals.averageKcal === null
              ? '—'
              : data.totals.averageKcal.toLocaleString('ja-JP')}
            <small> kcal</small>
          </dd>
        </div>
        <div>
          <dt>確定した寄付</dt>
          <dd>{formatYen(data.totals.donationYen)}</dd>
          {data.totals.pendingYen > 0 && (
            <small>確定待ち {formatYen(data.totals.pendingYen)}</small>
          )}
        </div>
      </dl>
      <p className="hint">
        平均は記録のある日のみ。
        {data.granularity === 'month'
          ? '月を選ぶと日別の記録を表示します。'
          : '今日までの記録を表示しています。'}
      </p>
      {data.granularity === 'month' ? (
        <ul className="period-months" aria-label="月別のサマリー">
          {data.months.map((month) => (
            <li key={month.month}>
              <button
                type="button"
                className="period-month"
                disabled={month.status === 'future'}
                onClick={() => onMonth(month.month)}
              >
                <strong>
                  {Number(month.month.slice(5))}
                  <small>月</small>
                </strong>
                <span className="period-month-detail">
                  {month.status === 'future'
                    ? '未到来'
                    : month.loggedDays === 0
                      ? '記録なし'
                      : `${month.loggedDays}日記録 · 平均 ${formatKcal(month.averageKcal!)}`}
                  {month.status === 'partial' && <small>集計中</small>}
                </span>
                <span className="period-month-amount">
                  {month.loggedDays ? formatYen(month.donationYen) : '—'}
                  {month.pendingYen > 0 && (
                    <small>確定待ち {formatYen(month.pendingYen)}</small>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="history-list period-days" aria-label="日別の記録">
          {data.days.map((day) => (
            <li key={day.date}>
              <Link
                href={day.date === data.today ? '/' : `/?date=${day.date}`}
                className="history-row"
                data-over={day.overKcal > 0}
              >
                <span className="history-date">
                  {formatDateLabel(day.date, data.today)}
                </span>
                <span className="history-kcal">
                  {day.mealCount
                    ? `${formatKcal(day.consumedKcal)} / 目標 ${formatKcal(day.targetKcal)}`
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
      )}
    </>
  );
}
