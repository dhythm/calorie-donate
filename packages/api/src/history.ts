import { addDays } from './domain';
import type { HistoryDay, HistoryPeriod, PeriodHistory } from './schemas';

/** Calendar periods, with weeks starting on Monday, independent of host TZ. */
export function historyPeriodRange(period: HistoryPeriod, anchor: string) {
  const month = anchor.slice(0, 7);
  if (period === 'year') {
    return {
      from: `${anchor.slice(0, 4)}-01-01`,
      to: `${anchor.slice(0, 4)}-12-31`,
    };
  }
  if (period === 'month') {
    const next = new Date(`${month}-01T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return {
      from: `${month}-01`,
      to: addDays(next.toISOString().slice(0, 10), -1),
    };
  }
  const weekday = new Date(`${anchor}T00:00:00Z`).getUTCDay();
  const from = addDays(anchor, -((weekday + 6) % 7));
  return { from, to: addDays(from, 6) };
}

export function shiftHistoryPeriod(
  period: HistoryPeriod,
  anchor: string,
  amount: number,
) {
  const { from } = historyPeriodRange(period, anchor);
  if (period === 'week') return addDays(from, amount * 7);
  const next = new Date(`${from}T00:00:00Z`);
  if (period === 'month') next.setUTCMonth(next.getUTCMonth() + amount);
  else next.setUTCFullYear(next.getUTCFullYear() + amount);
  return next.toISOString().slice(0, 10);
}

export function historyPeriodLabel(period: HistoryPeriod, anchor: string) {
  const { from, to } = historyPeriodRange(period, anchor);
  const [year, month] = from.split('-').map(Number);
  if (period === 'year') return `${year}年`;
  if (period === 'month') return `${year}年${month}月`;
  const short = (date: string) =>
    `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  return `${year}年 ${short(from)}–${short(to)}`;
}

function totals(days: HistoryDay[]) {
  const logged = days.filter((day) => day.mealCount > 0);
  return {
    loggedDays: logged.length,
    averageKcal: logged.length
      ? Math.round(
          logged.reduce((sum, day) => sum + day.consumedKcal, 0) /
            logged.length,
        )
      : null,
    donationYen: days.reduce(
      (sum, day) => sum + (day.status === 'settled' ? day.donationYen : 0),
      0,
    ),
    pendingYen: days.reduce(
      (sum, day) => sum + (day.status === 'open' ? day.donationYen : 0),
      0,
    ),
  };
}

/** Year responses contain monthly summaries only; unlogged days do not dilute averages. */
export function summarizeHistoryPeriod(
  period: HistoryPeriod,
  anchor: string,
  today: string,
  days: HistoryDay[],
): PeriodHistory {
  const range = historyPeriodRange(period, anchor);
  const inRange = days.filter(
    (day) =>
      day.date >= range.from && day.date <= range.to && day.date <= today,
  );
  const base = { ...range, today, totals: totals(inRange) };
  if (period !== 'year') {
    return {
      ...base,
      period,
      granularity: 'day',
      days: [...inRange].sort((a, b) => b.date.localeCompare(a.date)),
    };
  }
  const year = range.from.slice(0, 4);
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    const monthDays = inRange.filter((day) => day.date.startsWith(month));
    const monthRange = historyPeriodRange('month', `${month}-01`);
    return {
      month,
      ...totals(monthDays),
      consumedKcal: monthDays.reduce((sum, day) => sum + day.consumedKcal, 0),
      status:
        monthRange.from > today
          ? ('future' as const)
          : monthRange.to >= today
            ? ('partial' as const)
            : ('complete' as const),
    };
  });
  return { ...base, period, granularity: 'month', months };
}
