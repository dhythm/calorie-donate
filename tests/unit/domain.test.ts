import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildHabitStats,
  dateKeyInTimeZone,
  dateKeySchema,
  dateRange,
  donationForOverage,
  formatDateLabel,
  isEditableDay,
  isSettleableDay,
  suggestMealType,
  summarizeDay,
} from '../../packages/api/src/index';

describe('calendar helpers', () => {
  it('computes the local day in the profile time zone', () => {
    const now = new Date('2026-10-12T16:30:00Z');
    expect(dateKeyInTimeZone(now, 'Asia/Tokyo')).toBe('2026-10-13');
    expect(dateKeyInTimeZone(now, 'America/Los_Angeles')).toBe('2026-10-12');
  });
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(dateRange('2026-10-10', '2026-10-12')).toEqual([
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ]);
  });
  it('rejects impossible dates', () => {
    expect(dateKeySchema.safeParse('2026-02-30').success).toBe(false);
    expect(dateKeySchema.safeParse('2026-2-1').success).toBe(false);
    expect(dateKeySchema.safeParse('2026-02-28').success).toBe(true);
  });
  it('keeps today and yesterday editable and settles older days', () => {
    const today = '2026-10-12';
    expect(isEditableDay('2026-10-12', today)).toBe(true);
    expect(isEditableDay('2026-10-11', today)).toBe(true);
    expect(isEditableDay('2026-10-10', today)).toBe(false);
    expect(isEditableDay('2026-10-13', today)).toBe(false);
    expect(isSettleableDay('2026-10-10', today)).toBe(true);
    expect(isSettleableDay('2026-10-11', today)).toBe(false);
  });
  it('labels recent days for the UI', () => {
    expect(formatDateLabel('2026-10-12', '2026-10-12')).toBe('今日');
    expect(formatDateLabel('2026-10-11', '2026-10-12')).toBe('昨日');
    expect(formatDateLabel('2026-10-04', '2026-10-12')).toBe('10/4（日）');
  });
  it('suggests a meal type from the hour', () => {
    expect(suggestMealType(7)).toBe('breakfast');
    expect(suggestMealType(12)).toBe('lunch');
    expect(suggestMealType(19)).toBe('dinner');
    expect(suggestMealType(23)).toBe('snack');
  });
});

describe('donation calculation', () => {
  it('donates only for calories over the target, rounded down', () => {
    expect(donationForOverage(0, 100)).toBe(0);
    expect(donationForOverage(-50, 100)).toBe(0);
    expect(donationForOverage(250, 100)).toBe(250);
    expect(donationForOverage(155, 30)).toBe(46);
  });
  it('summarizes a day under and over target', () => {
    const base = {
      date: '2026-10-12',
      today: '2026-10-12',
      targetKcal: 2000,
      yenPer100Kcal: 50,
      settled: false,
    };
    expect(summarizeDay({ ...base, consumedKcal: 1500 })).toMatchObject({
      remainingKcal: 500,
      overKcal: 0,
      donationYen: 0,
      editable: true,
      status: 'open',
    });
    expect(summarizeDay({ ...base, consumedKcal: 2400 })).toMatchObject({
      remainingKcal: 0,
      overKcal: 400,
      donationYen: 200,
    });
  });
});

describe('habit stats', () => {
  const day = (date: string, consumedKcal: number, mealCount = 1) => ({
    date,
    targetKcal: 2000,
    consumedKcal,
    overKcal: Math.max(0, consumedKcal - 2000),
    donationYen: Math.max(0, consumedKcal - 2000),
    mealCount,
    byMealType: { breakfast: 0, lunch: consumedKcal, dinner: 0, snack: 0 },
  });

  it('keeps streaks alive while today is not logged yet', () => {
    const stats = buildHabitStats('2026-10-12', [
      day('2026-10-08', 1800),
      day('2026-10-09', 0, 0),
      day('2026-10-10', 1900),
      day('2026-10-11', 1700),
      day('2026-10-12', 0, 0),
    ]);
    expect(stats.streaks).toEqual({
      currentLogging: 2,
      bestLogging: 2,
      currentWithinTarget: 2,
      bestWithinTarget: 2,
    });
  });

  it('breaks the target streak on an over day but not the logging streak', () => {
    const stats = buildHabitStats('2026-10-12', [
      day('2026-10-10', 1900),
      day('2026-10-11', 2500),
      day('2026-10-12', 1500),
    ]);
    expect(stats.streaks).toMatchObject({
      currentLogging: 3,
      currentWithinTarget: 1,
      bestWithinTarget: 1,
    });
    expect(stats.summary).toEqual({
      loggedDays: 3,
      withinTargetDays: 2,
      achievementRate: 2 / 3,
      averageKcal: 1967,
      donationYen: 500,
    });
    // 2026-10-10 is a Saturday.
    expect(stats.weekdays[6]).toEqual({
      weekday: 6,
      averageKcal: 1900,
      loggedDays: 1,
    });
    expect(stats.mealTypes.lunch).toBe(1967);
  });
});
