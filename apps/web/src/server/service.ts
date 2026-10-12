import 'server-only';
import {
  addDays,
  buildHabitStats,
  DEFAULT_TIME_ZONE,
  dateKeyInTimeZone,
  dateRange,
  IMAGE_MAX_BYTES,
  isEditableDay,
  mealInputSchema,
  mealTypes,
  oldestEditableDay,
  photoUploadSchema,
  profileInputSchema,
  summarizeDay,
  type ApiErrorCode,
  type DayDetail,
  type DaySummary,
  type DonationLedger,
  type DonationTotals,
  type HabitDay,
  type HabitStats,
  type History,
  type Meal,
  type MealInput,
  type MealType,
  type Overview,
  type Photo,
  type PhotoUpload,
  type Profile,
  type ProfileInput,
} from '@calorie-donate/api';
import { and, asc, desc, eq, gt, gte, lt, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from './db/client';
import { mealPhotos, meals, profiles, settlements } from './db/schema';
import { detectImageType } from './image';

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

/** The only user until accounts exist; every row is already scoped by it. */
const LOCAL_USER_ID = 'local';
const HISTORY_MAX_DAYS = 90;
const STATS_MIN_DAYS = 7;
const STATS_MAX_DAYS = 371;
/** Photos uploaded but never attached to a meal are dropped after a day. */
const ORPHAN_PHOTO_MS = 24 * 60 * 60 * 1000;

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Executor = Database | Tx;
type MealRow = typeof meals.$inferSelect;
type DayTotals = {
  consumedKcal: number;
  mealCount: number;
  byMealType: Record<MealType, number>;
};
type SettlementRow = typeof settlements.$inferSelect;

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

const isUuid = (id: string) => z.uuid().safeParse(id).success;
const notFound = (what: string) =>
  new ServiceError('NOT_FOUND', 404, `${what} not found.`);

function requireProfile(profile: Profile | null): Profile {
  if (!profile) {
    throw new ServiceError(
      'PROFILE_REQUIRED',
      409,
      'Set a daily calorie target before logging meals.',
    );
  }
  return profile;
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

const toMeal = (row: MealRow): Meal => ({
  id: row.id,
  date: row.date,
  mealType: row.mealType as MealType,
  name: row.name,
  calories: row.calories,
  source: row.source as Meal['source'],
  items: row.items,
  note: row.note,
  photoId: row.photoId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const emptyTotals = (): DayTotals => ({
  consumedKcal: 0,
  mealCount: 0,
  byMealType: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
});

function summarize(
  date: string,
  today: string,
  profile: Profile,
  totals: DayTotals | undefined,
  settled: SettlementRow | undefined,
): DaySummary {
  if (settled) {
    return summarizeDay({
      date,
      today,
      targetKcal: settled.targetKcal,
      consumedKcal: settled.consumedKcal,
      yenPer100Kcal: settled.donationYenPer100Kcal,
      settled: true,
    });
  }
  return summarizeDay({
    date,
    today,
    targetKcal: profile.dailyTargetKcal,
    consumedKcal: totals?.consumedKcal ?? 0,
    yenPer100Kcal: profile.donationYenPer100Kcal,
    // A past day with no meals has nothing to record but is still closed.
    settled: !isEditableDay(date, today),
  });
}

export function createService(
  db: Database,
  clock: () => Date = () => new Date(),
  userId: string = LOCAL_USER_ID,
) {
  const todayFor = (profile: Profile | null, now: Date) =>
    dateKeyInTimeZone(now, profile?.timeZone ?? DEFAULT_TIME_ZONE);

  async function loadProfile(tx: Executor): Promise<Profile | null> {
    const [row] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId));
    if (!row) return null;
    return {
      displayName: row.displayName,
      dailyTargetKcal: row.dailyTargetKcal,
      donationYenPer100Kcal: row.donationYenPer100Kcal,
      timeZone: row.timeZone,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Lock past days and record each day's overage in the donation ledger. */
  async function settle(tx: Executor, profile: Profile, today: string) {
    const pending = await tx
      .select({
        date: meals.date,
        consumedKcal: sql<number>`sum(${meals.calories})::int`,
      })
      .from(meals)
      .where(
        and(
          eq(meals.userId, userId),
          lt(meals.date, oldestEditableDay(today)),
          sql`not exists (select 1 from ${settlements} where ${settlements.userId} = ${meals.userId} and ${settlements.date} = ${meals.date})`,
        ),
      )
      .groupBy(meals.date);
    if (pending.length === 0) return;
    await tx
      .insert(settlements)
      .values(
        pending.map(({ date, consumedKcal }) => {
          const day = summarizeDay({
            date,
            today,
            targetKcal: profile.dailyTargetKcal,
            consumedKcal,
            yenPer100Kcal: profile.donationYenPer100Kcal,
            settled: true,
          });
          return {
            userId,
            date,
            targetKcal: day.targetKcal,
            consumedKcal: day.consumedKcal,
            overKcal: day.overKcal,
            donationYen: day.donationYen,
            donationYenPer100Kcal: day.donationYenPer100Kcal,
          };
        }),
      )
      .onConflictDoNothing();
  }

  /** Profile and today's date, with any newly closed days settled. */
  async function current() {
    const now = clock();
    const profile = await loadProfile(db);
    const today = todayFor(profile, now);
    if (profile) await settle(db, profile, today);
    return { profile, today };
  }

  /** Per-day meal totals and ledger rows for an inclusive date range. */
  async function loadRange(from: string, to: string) {
    const rows = await db
      .select({
        date: meals.date,
        mealType: meals.mealType,
        calories: sql<number>`sum(${meals.calories})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(meals)
      .where(
        and(
          eq(meals.userId, userId),
          gte(meals.date, from),
          lte(meals.date, to),
        ),
      )
      .groupBy(meals.date, meals.mealType);
    const totals = new Map<string, DayTotals>();
    for (const row of rows) {
      const day = totals.get(row.date) ?? emptyTotals();
      day.consumedKcal += row.calories;
      day.mealCount += row.count;
      if ((mealTypes as readonly string[]).includes(row.mealType)) {
        day.byMealType[row.mealType as MealType] += row.calories;
      }
      totals.set(row.date, day);
    }
    const ledger = await db
      .select()
      .from(settlements)
      .where(
        and(
          eq(settlements.userId, userId),
          gte(settlements.date, from),
          lte(settlements.date, to),
        ),
      );
    return {
      totals,
      settled: new Map(ledger.map((entry) => [entry.date, entry])),
    };
  }

  async function summaries(
    profile: Profile,
    today: string,
    from: string,
    to: string = today,
  ) {
    const range = await loadRange(from, to);
    return dateRange(from, to).map((date) => ({
      summary: summarize(
        date,
        today,
        profile,
        range.totals.get(date),
        range.settled.get(date),
      ),
      totals: range.totals.get(date) ?? emptyTotals(),
    }));
  }

  async function donationTotals(
    profile: Profile,
    today: string,
  ): Promise<DonationTotals> {
    const [ledger] = await db
      .select({
        totalYen: sql<number>`coalesce(sum(${settlements.donationYen}), 0)::int`,
        totalOverKcal: sql<number>`coalesce(sum(${settlements.overKcal}), 0)::int`,
        daysOver: sql<number>`count(*)::int`,
      })
      .from(settlements)
      .where(
        and(eq(settlements.userId, userId), gt(settlements.donationYen, 0)),
      );
    const open = await summaries(profile, today, addDays(today, -1));
    return {
      totalYen: ledger?.totalYen ?? 0,
      totalOverKcal: ledger?.totalOverKcal ?? 0,
      daysOver: ledger?.daysOver ?? 0,
      pendingYen: open
        .filter(({ summary }) => summary.status === 'open')
        .reduce((sum, { summary }) => sum + summary.donationYen, 0),
    };
  }

  async function detail(
    profile: Profile,
    date: string,
    today: string,
  ): Promise<DayDetail> {
    const [day] = await summaries(profile, today, date, date);
    const rows = await db
      .select()
      .from(meals)
      .where(and(eq(meals.userId, userId), eq(meals.date, date)))
      .orderBy(asc(meals.createdAt));
    return { ...day!.summary, meals: rows.map(toMeal) };
  }

  /** Run a meal change in a transaction against an editable day. */
  async function changeMeals<T>(
    change: (tx: Tx, today: string) => Promise<T>,
  ): Promise<T> {
    const now = clock();
    return db.transaction(async (tx) => {
      const profile = requireProfile(await loadProfile(tx));
      const today = todayFor(profile, now);
      await settle(tx, profile, today);
      return change(tx, today);
    });
  }

  async function findMeal(tx: Executor, id: string): Promise<MealRow> {
    if (!isUuid(id)) throw notFound('Meal');
    const [row] = await tx
      .select()
      .from(meals)
      .where(and(eq(meals.userId, userId), eq(meals.id, id)));
    if (!row) throw notFound('Meal');
    return row;
  }

  async function assertPhoto(tx: Executor, photoId: string | null) {
    if (!photoId) return;
    const [row] = await tx
      .select({ id: mealPhotos.id })
      .from(mealPhotos)
      .where(and(eq(mealPhotos.userId, userId), eq(mealPhotos.id, photoId)));
    if (!row) {
      throw new ServiceError('INVALID_REQUEST', 400, 'photoId: unknown photo.');
    }
  }

  async function deletePhoto(tx: Executor, photoId: string | null) {
    if (!photoId) return;
    await tx
      .delete(mealPhotos)
      .where(and(eq(mealPhotos.userId, userId), eq(mealPhotos.id, photoId)));
  }

  return {
    async overview(date?: string): Promise<Overview> {
      const { profile, today } = await current();
      if (!profile) {
        return { today, profile: null, day: null, totals: null };
      }
      const day = date ?? today;
      assertViewableDate(day, today);
      return {
        today,
        profile,
        day: await detail(profile, day, today),
        totals: await donationTotals(profile, today),
      };
    },

    async saveProfile(input: ProfileInput): Promise<Profile> {
      const values = parse(profileInputSchema, input);
      const now = clock();
      await db
        .insert(profiles)
        .values({ userId, ...values, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: { ...values, updatedAt: now },
        });
      return requireProfile(await loadProfile(db));
    },

    async day(date: string): Promise<DayDetail> {
      const { profile, today } = await current();
      assertViewableDate(date, today);
      return detail(requireProfile(profile), date, today);
    },

    async history(days: number): Promise<History> {
      const { profile, today } = await current();
      const count = Math.min(Math.max(1, Math.trunc(days)), HISTORY_MAX_DAYS);
      const rows = await summaries(
        requireProfile(profile),
        today,
        addDays(today, -(count - 1)),
      );
      return { days: rows.map(({ summary }) => summary).reverse() };
    },

    async stats(days: number): Promise<HabitStats> {
      const { profile, today } = await current();
      const count = Math.min(
        Math.max(STATS_MIN_DAYS, Math.trunc(days)),
        STATS_MAX_DAYS,
      );
      const rows = await summaries(
        requireProfile(profile),
        today,
        addDays(today, -(count - 1)),
      );
      return buildHabitStats(
        today,
        rows.map(({ summary, totals }): HabitDay => ({
          date: summary.date,
          targetKcal: summary.targetKcal,
          consumedKcal: summary.consumedKcal,
          overKcal: summary.overKcal,
          donationYen: summary.donationYen,
          mealCount: totals.mealCount,
          byMealType: totals.byMealType,
        })),
      );
    },

    async meal(id: string): Promise<Meal> {
      return toMeal(await findMeal(db, id));
    },

    async createMeal(input: MealInput): Promise<Meal> {
      const values = parse(mealInputSchema, input);
      return changeMeals(async (tx, today) => {
        assertEditable(values.date, today);
        await assertPhoto(tx, values.photoId);
        const [row] = await tx
          .insert(meals)
          .values({ ...values, userId })
          .returning();
        return toMeal(row!);
      });
    },

    async updateMeal(id: string, input: MealInput): Promise<Meal> {
      const values = parse(mealInputSchema, input);
      return changeMeals(async (tx, today) => {
        const meal = await findMeal(tx, id);
        assertEditable(meal.date, today);
        assertEditable(values.date, today);
        await assertPhoto(tx, values.photoId);
        const [row] = await tx
          .update(meals)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(meals.id, meal.id))
          .returning();
        if (meal.photoId !== values.photoId)
          await deletePhoto(tx, meal.photoId);
        return toMeal(row!);
      });
    },

    async deleteMeal(id: string): Promise<void> {
      await changeMeals(async (tx, today) => {
        const meal = await findMeal(tx, id);
        assertEditable(meal.date, today);
        await tx.delete(meals).where(eq(meals.id, meal.id));
        await deletePhoto(tx, meal.photoId);
      });
    },

    async donations(): Promise<DonationLedger> {
      const { profile, today } = await current();
      const entries = await db
        .select()
        .from(settlements)
        .where(
          and(eq(settlements.userId, userId), gt(settlements.donationYen, 0)),
        )
        .orderBy(desc(settlements.date));
      return {
        totals: await donationTotals(requireProfile(profile), today),
        entries: entries.map((entry) => ({
          date: entry.date,
          targetKcal: entry.targetKcal,
          consumedKcal: entry.consumedKcal,
          overKcal: entry.overKcal,
          donationYen: entry.donationYen,
          donationYenPer100Kcal: entry.donationYenPer100Kcal,
          settledAt: entry.settledAt.toISOString(),
        })),
      };
    },

    /** Store a meal photo. The image bytes decide its type, not the client. */
    async uploadPhoto(input: PhotoUpload): Promise<Photo> {
      const values = parse(photoUploadSchema, input);
      const data = Buffer.from(values.imageBase64, 'base64');
      const contentType = detectImageType(data);
      if (!contentType || data.byteLength > IMAGE_MAX_BYTES) {
        throw new ServiceError(
          'INVALID_REQUEST',
          400,
          'Send a JPEG, PNG, WebP or GIF image of at most 5 MB.',
        );
      }
      const now = clock();
      const cutoff = new Date(now.getTime() - ORPHAN_PHOTO_MS);
      await db
        .delete(mealPhotos)
        .where(
          and(
            eq(mealPhotos.userId, userId),
            lt(mealPhotos.createdAt, cutoff),
            sql`not exists (select 1 from ${meals} where ${meals.photoId} = ${mealPhotos.id})`,
          ),
        );
      const [row] = await db
        .insert(mealPhotos)
        .values({
          userId,
          contentType,
          byteSize: data.byteLength,
          data,
          createdAt: now,
        })
        .returning({
          id: mealPhotos.id,
          contentType: mealPhotos.contentType,
          byteSize: mealPhotos.byteSize,
          createdAt: mealPhotos.createdAt,
        });
      return {
        id: row!.id,
        contentType,
        byteSize: row!.byteSize,
        createdAt: row!.createdAt.toISOString(),
      };
    },

    async photo(id: string) {
      if (!isUuid(id)) throw notFound('Photo');
      const [row] = await db
        .select({ contentType: mealPhotos.contentType, data: mealPhotos.data })
        .from(mealPhotos)
        .where(and(eq(mealPhotos.userId, userId), eq(mealPhotos.id, id)));
      if (!row) throw notFound('Photo');
      return {
        contentType: row.contentType as PhotoUpload['mediaType'],
        data: Buffer.from(row.data),
      };
    },
  };
}

export type Service = ReturnType<typeof createService>;
