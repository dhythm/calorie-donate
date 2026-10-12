import type { DaySummary, HabitDay, HabitStats, MealType } from './schemas';

/**
 * Meals can be added or changed for today and yesterday (so a late dinner can
 * still be logged the next morning). Older days are settled: their overage is
 * recorded as a donation and they become read-only.
 */
export const EDITABLE_DAYS = 2;

export const DEFAULT_TARGET_KCAL = 2000;
export const DEFAULT_YEN_PER_100_KCAL = 100;
export const DEFAULT_TIME_ZONE = 'Asia/Tokyo';

/** Calendar day (`YYYY-MM-DD`) of `now` in the given IANA time zone. */
export function dateKeyInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Inclusive list of days from `from` to `to`, oldest first. */
export function dateRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

/** Oldest day that is still editable when today is `today`. */
export function oldestEditableDay(today: string): string {
  return addDays(today, -(EDITABLE_DAYS - 1));
}

export function isEditableDay(date: string, today: string): boolean {
  return date <= today && date >= oldestEditableDay(today);
}

export function isSettleableDay(date: string, today: string): boolean {
  return date < oldestEditableDay(today);
}

/** Donation for calories over target, rounded down to whole yen. */
export function donationForOverage(
  overKcal: number,
  yenPer100Kcal: number,
): number {
  if (overKcal <= 0) return 0;
  return Math.floor((overKcal * yenPer100Kcal) / 100);
}

export function summarizeDay({
  date,
  today,
  targetKcal,
  consumedKcal,
  yenPer100Kcal,
  settled,
}: {
  date: string;
  today: string;
  targetKcal: number;
  consumedKcal: number;
  yenPer100Kcal: number;
  settled: boolean;
}): DaySummary {
  const overKcal = Math.max(0, consumedKcal - targetKcal);
  return {
    date,
    status: settled ? 'settled' : 'open',
    editable: !settled && isEditableDay(date, today),
    targetKcal,
    consumedKcal,
    remainingKcal: Math.max(0, targetKcal - consumedKcal),
    overKcal,
    donationYen: donationForOverage(overKcal, yenPer100Kcal),
    donationYenPer100Kcal: yenPer100Kcal,
  };
}

export const mealTypeLabels: Record<MealType, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
  snack: '間食',
};

/** Suggest a meal slot from the local hour so forms start sensibly. */
export function suggestMealType(hour: number): MealType {
  if (hour >= 4 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 15) return 'lunch';
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'snack';
}

export function formatKcal(kcal: number): string {
  return `${kcal.toLocaleString('ja-JP')} kcal`;
}

export function formatYen(yen: number): string {
  return `¥${yen.toLocaleString('ja-JP')}`;
}

export function formatDateLabel(date: string, today: string): string {
  if (date === today) return '今日';
  if (date === addDays(today, -1)) return '昨日';
  const [, month, day] = date.split('-');
  const weekday = weekdayLabels[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${Number(month)}/${Number(day)}（${weekday}）`;
}

/** 0–1 share of target consumed, capped for progress bars. */
export function progressRatio(consumedKcal: number, targetKcal: number) {
  if (targetKcal <= 0) return 0;
  return Math.min(1, consumedKcal / targetKcal);
}

/** Longest run, and the run ending at the newest day, of days matching `hit`. */
function runs<T>(days: T[], hit: (day: T) => boolean, skipNewest: boolean) {
  let best = 0;
  let run = 0;
  for (const day of days) {
    run = hit(day) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  // Today is not over yet: an unlogged today keeps yesterday's streak alive.
  const recent = skipNewest ? days.slice(0, -1) : days;
  let current = 0;
  for (let i = recent.length - 1; i >= 0 && hit(recent[i]!); i--) current++;
  return { best, current };
}

/** Streaks, averages and breakdowns for habit charts. `days` oldest first. */
export function buildHabitStats(today: string, days: HabitDay[]): HabitStats {
  const logged = days.filter((day) => day.mealCount > 0);
  const within = (day: HabitDay) => day.mealCount > 0 && day.overKcal === 0;
  const newest = days.at(-1);
  const skipNewest = newest?.date === today && newest.mealCount === 0;
  const logging = runs(days, (day) => day.mealCount > 0, skipNewest);
  const target = runs(days, within, skipNewest);
  const average = (values: number[]) =>
    values.length === 0
      ? 0
      : Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
  const mealAverage = (type: MealType) =>
    average(logged.map((day) => day.byMealType[type]));
  return {
    today,
    days,
    streaks: {
      currentLogging: logging.current,
      bestLogging: logging.best,
      currentWithinTarget: target.current,
      bestWithinTarget: target.best,
    },
    summary: {
      loggedDays: logged.length,
      withinTargetDays: logged.filter(within).length,
      achievementRate:
        logged.length === 0 ? 0 : logged.filter(within).length / logged.length,
      averageKcal: average(logged.map((day) => day.consumedKcal)),
      donationYen: days.reduce((sum, day) => sum + day.donationYen, 0),
    },
    weekdays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
      const matching = logged.filter(
        (day) => new Date(`${day.date}T00:00:00Z`).getUTCDay() === weekday,
      );
      return {
        weekday,
        averageKcal: average(matching.map((day) => day.consumedKcal)),
        loggedDays: matching.length,
      };
    }),
    mealTypes: {
      breakfast: mealAverage('breakfast'),
      lunch: mealAverage('lunch'),
      dinner: mealAverage('dinner'),
      snack: mealAverage('snack'),
    },
  };
}

export const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
