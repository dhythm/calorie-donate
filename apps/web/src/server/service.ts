import 'server-only';
import {
  addDays,
  DEFAULT_TIME_ZONE,
  dateKeyInTimeZone,
  dateRange,
  isEditableDay,
  isSettleableDay,
  mealInputSchema,
  profileInputSchema,
  summarizeDay,
  type ApiErrorCode,
  type DayDetail,
  type DaySummary,
  type DonationEntry,
  type DonationLedger,
  type DonationTotals,
  type History,
  type Meal,
  type MealInput,
  type Overview,
  type Profile,
  type ProfileInput,
} from '@calorie-donate/api';
import { z } from 'zod';
import type { Store, StoreData } from './store';

export class ServiceError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

const HISTORY_MAX_DAYS = 90;

function requireProfile(data: StoreData): Profile {
  if (!data.profile) {
    throw new ServiceError(
      'PROFILE_REQUIRED',
      409,
      'Set a daily calorie target before logging meals.',
    );
  }
  return data.profile;
}

const consumedOn = (data: StoreData, date: string) =>
  data.meals
    .filter((meal) => meal.date === date)
    .reduce((sum, meal) => sum + meal.calories, 0);

/** Days whose overage should be recorded as a donation but is not yet. */
function unsettledDays(data: StoreData, today: string): string[] {
  const settled = new Set(data.settlements.map((entry) => entry.date));
  const days = new Set(
    data.meals
      .map((meal) => meal.date)
      .filter((date) => isSettleableDay(date, today) && !settled.has(date)),
  );
  return [...days].sort();
}

/** Lock past days and record each day's overage in the donation ledger. */
function settle(data: StoreData, today: string, now: Date) {
  const profile = data.profile;
  if (!profile) return;
  for (const date of unsettledDays(data, today)) {
    const day = summarizeDay({
      date,
      today,
      targetKcal: profile.dailyTargetKcal,
      consumedKcal: consumedOn(data, date),
      yenPer100Kcal: profile.donationYenPer100Kcal,
      settled: true,
    });
    data.settlements.push({
      date,
      targetKcal: day.targetKcal,
      consumedKcal: day.consumedKcal,
      overKcal: day.overKcal,
      donationYen: day.donationYen,
      donationYenPer100Kcal: day.donationYenPer100Kcal,
      settledAt: now.toISOString(),
    });
  }
  data.settlements.sort((a, b) => a.date.localeCompare(b.date));
}

function summarize(
  data: StoreData,
  profile: Profile,
  date: string,
  today: string,
): DaySummary {
  const entry = data.settlements.find((settled) => settled.date === date);
  if (entry) {
    return summarizeDay({
      date,
      today,
      targetKcal: entry.targetKcal,
      consumedKcal: entry.consumedKcal,
      yenPer100Kcal: entry.donationYenPer100Kcal,
      settled: true,
    });
  }
  return summarizeDay({
    date,
    today,
    targetKcal: profile.dailyTargetKcal,
    consumedKcal: consumedOn(data, date),
    yenPer100Kcal: profile.donationYenPer100Kcal,
    // A past day with no meals has nothing to record but is still closed.
    settled: isSettleableDay(date, today),
  });
}

function detail(
  data: StoreData,
  profile: Profile,
  date: string,
  today: string,
): DayDetail {
  return {
    ...summarize(data, profile, date, today),
    meals: data.meals
      .filter((meal) => meal.date === date)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

function totals(data: StoreData, profile: Profile, today: string) {
  const over = data.settlements.filter((entry) => entry.donationYen > 0);
  const pendingYen = dateRange(addDays(today, -1), today)
    .map((date) => summarize(data, profile, date, today))
    .filter((day) => day.status === 'open')
    .reduce((sum, day) => sum + day.donationYen, 0);
  return {
    totalYen: over.reduce((sum, entry) => sum + entry.donationYen, 0),
    totalOverKcal: over.reduce((sum, entry) => sum + entry.overKcal, 0),
    daysOver: over.length,
    pendingYen,
  } satisfies DonationTotals;
}

function assertViewableDate(date: string, today: string) {
  if (date > today) {
    throw new ServiceError(
      'INVALID_REQUEST',
      400,
      'date must not be in the future.',
    );
  }
}

function assertEditable(date: string, today: string) {
  if (!isEditableDay(date, today)) {
    throw new ServiceError(
      'DAY_LOCKED',
      409,
      'Only today and yesterday can be changed; older days are settled.',
    );
  }
}

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ServiceError(
      'INVALID_REQUEST',
      400,
      issue
        ? `${issue.path.map(String).join('.') || 'body'}: ${issue.message}`
        : 'Invalid request.',
    );
  }
  return result.data;
}

export function createService(
  store: Store,
  clock: () => Date = () => new Date(),
) {
  const todayFor = (profile: Profile | null, now: Date) =>
    dateKeyInTimeZone(now, profile?.timeZone ?? DEFAULT_TIME_ZONE);

  /** Read the store, settling past days first when there is work to do. */
  async function readSettled() {
    const now = clock();
    let data = await store.read();
    const today = todayFor(data.profile, now);
    if (data.profile && unsettledDays(data, today).length > 0) {
      data = await store.update((draft) => {
        settle(draft, todayFor(draft.profile, now), now);
        return draft;
      });
    }
    return { data, today: todayFor(data.profile, now), now };
  }

  async function changeMeals<T>(
    change: (data: StoreData, today: string, now: Date) => T,
  ): Promise<T> {
    const now = clock();
    return store.update((data) => {
      const today = todayFor(requireProfile(data), now);
      settle(data, today, now);
      return change(data, today, now);
    });
  }

  function findMeal(data: StoreData, id: string): Meal {
    const meal = data.meals.find((candidate) => candidate.id === id);
    if (!meal) throw new ServiceError('NOT_FOUND', 404, 'Meal not found.');
    return meal;
  }

  return {
    async overview(date?: string): Promise<Overview> {
      const { data, today } = await readSettled();
      const profile = data.profile;
      if (!profile) {
        return { today, profile: null, day: null, totals: null };
      }
      const day = date ?? today;
      assertViewableDate(day, today);
      return {
        today,
        profile,
        day: detail(data, profile, day, today),
        totals: totals(data, profile, today),
      };
    },

    async saveProfile(input: ProfileInput): Promise<Profile> {
      const values = parse(profileInputSchema, input);
      const now = clock().toISOString();
      return store.update((data) => {
        data.profile = {
          ...values,
          createdAt: data.profile?.createdAt ?? now,
          updatedAt: now,
        };
        return data.profile;
      });
    },

    async day(date: string): Promise<DayDetail> {
      const { data, today } = await readSettled();
      const profile = requireProfile(data);
      assertViewableDate(date, today);
      return detail(data, profile, date, today);
    },

    async history(days: number): Promise<History> {
      const { data, today } = await readSettled();
      const profile = requireProfile(data);
      const count = Math.min(Math.max(1, Math.trunc(days)), HISTORY_MAX_DAYS);
      return {
        days: dateRange(addDays(today, -(count - 1)), today)
          .reverse()
          .map((date) => summarize(data, profile, date, today)),
      };
    },

    async meal(id: string): Promise<Meal> {
      const { data } = await readSettled();
      return findMeal(data, id);
    },

    async createMeal(input: MealInput): Promise<Meal> {
      const values = parse(mealInputSchema, input);
      return changeMeals((data, today, now) => {
        assertEditable(values.date, today);
        const meal: Meal = {
          ...values,
          id: crypto.randomUUID(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        data.meals.push(meal);
        return meal;
      });
    },

    async updateMeal(id: string, input: MealInput): Promise<Meal> {
      const values = parse(mealInputSchema, input);
      return changeMeals((data, today, now) => {
        const meal = findMeal(data, id);
        assertEditable(meal.date, today);
        assertEditable(values.date, today);
        Object.assign(meal, values, { updatedAt: now.toISOString() });
        return meal;
      });
    },

    async deleteMeal(id: string): Promise<void> {
      await changeMeals((data, today) => {
        const meal = findMeal(data, id);
        assertEditable(meal.date, today);
        data.meals = data.meals.filter((candidate) => candidate.id !== id);
      });
    },

    async donations(): Promise<DonationLedger> {
      const { data, today } = await readSettled();
      const profile = requireProfile(data);
      const entries: DonationEntry[] = data.settlements
        .filter((entry) => entry.donationYen > 0)
        .sort((a, b) => b.date.localeCompare(a.date));
      return { totals: totals(data, profile, today), entries };
    },
  };
}

export type Service = ReturnType<typeof createService>;
