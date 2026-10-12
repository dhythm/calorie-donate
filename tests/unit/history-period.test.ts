import { describe, expect, it } from 'vitest';
import {
  historyPeriodRange,
  shiftHistoryPeriod,
  summarizeHistoryPeriod,
  summarizeDay,
  periodHistorySchema,
  type HistoryDay,
} from '../../packages/api/src';

const day = (date: string, calories: number, mealCount = 1): HistoryDay => ({
  ...summarizeDay({
    date,
    today: '2024-03-02',
    targetKcal: 2000,
    consumedKcal: calories,
    yenPer100Kcal: 100,
    settled: date < '2024-03-01',
  }),
  mealCount,
});

describe('calendar history periods', () => {
  it('uses Monday weeks across year boundaries and calendar months including leap days', () => {
    expect(historyPeriodRange('week', '2026-01-01')).toEqual({
      from: '2025-12-29',
      to: '2026-01-04',
    });
    expect(historyPeriodRange('week', '2026-01-04')).toEqual({
      from: '2025-12-29',
      to: '2026-01-04',
    });
    expect(historyPeriodRange('month', '2024-02-15')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
    expect(historyPeriodRange('month', '2025-02-15').to).toBe('2025-02-28');
    expect(shiftHistoryPeriod('month', '2024-01-31', 1)).toBe('2024-02-01');
    expect(shiftHistoryPeriod('year', '2024-02-29', -1)).toBe('2023-01-01');
  });
  it('returns twelve months without daily records and excludes gaps from averages', () => {
    const result = summarizeHistoryPeriod('year', '2024-01-01', '2024-03-02', [
      day('2024-01-01', 0),
      day('2024-01-02', 2500),
      day('2024-01-03', 0, 0),
      day('2024-03-01', 2200),
      day('2023-12-31', 5000),
      day('2024-04-01', 5000),
    ]);
    expect(periodHistorySchema.safeParse(result).success).toBe(true);
    expect(result.granularity).toBe('month');
    if (result.granularity !== 'month') throw Error('Expected monthly output');
    expect(result.months).toHaveLength(12);
    expect(result).not.toHaveProperty('days');
    expect(result.months[0]).toMatchObject({
      month: '2024-01',
      loggedDays: 2,
      averageKcal: 1250,
      donationYen: 500,
      pendingYen: 0,
      status: 'complete',
    });
    expect(result.months[1]).toMatchObject({
      averageKcal: null,
      loggedDays: 0,
    });
    expect(result.months[2]).toMatchObject({
      pendingYen: 200,
      status: 'partial',
    });
    expect(result.months[3]).toMatchObject({
      averageKcal: null,
      status: 'future',
    });
    expect(result.totals).toEqual({
      loggedDays: 3,
      averageKcal: 1567,
      donationYen: 500,
      pendingYen: 200,
    });
  });
  it('keeps a month daily, newest first, without future or adjacent-month rows', () => {
    const result = summarizeHistoryPeriod('month', '2024-03-01', '2024-03-02', [
      day('2024-02-29', 100),
      day('2024-03-01', 0, 0),
      day('2024-03-02', 1000),
      day('2024-03-03', 9000),
    ]);
    if (result.granularity !== 'day') throw Error('Expected daily output');
    expect(result.days.map((row) => row.date)).toEqual([
      '2024-03-02',
      '2024-03-01',
    ]);
    expect(result.totals.averageKcal).toBe(1000);
  });
});
