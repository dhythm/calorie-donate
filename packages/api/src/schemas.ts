import { z } from 'zod';

export const healthSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('calorie-donate-api'),
});
export const echoSchema = z.object({
  message: z.string().trim().min(1).max(200),
});

export const apiErrorCodes = [
  'INVALID_REQUEST',
  'NOT_FOUND',
  'PROFILE_REQUIRED',
  'DAY_LOCKED',
  'NOT_FOOD',
  'ESTIMATION_FAILED',
  'INTERNAL_ERROR',
] as const;
export const apiErrorSchema = z.object({
  error: z.object({ code: z.enum(apiErrorCodes), message: z.string() }),
});
export type ApiErrorCode = (typeof apiErrorCodes)[number];

/** Calendar day in the user's time zone, `YYYY-MM-DD`. */
export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, 'date must be a real calendar day');

export const timeZoneSchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'timeZone must be an IANA time zone');

export const TARGET_KCAL_MIN = 800;
export const TARGET_KCAL_MAX = 6000;
export const RATE_MIN = 1;
export const RATE_MAX = 10_000;

export const profileInputSchema = z.object({
  displayName: z.string().trim().max(40).default(''),
  dailyTargetKcal: z.number().int().min(TARGET_KCAL_MIN).max(TARGET_KCAL_MAX),
  /** Donation in JPY for every 100 kcal over the daily target. */
  donationYenPer100Kcal: z.number().int().min(RATE_MIN).max(RATE_MAX),
  timeZone: timeZoneSchema,
});
export const profileSchema = profileInputSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const mealTypeSchema = z.enum(mealTypes);
export const mealSourceSchema = z.enum(['manual', 'photo']);
export const MEAL_KCAL_MAX = 10_000;

export const mealItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  calories: z.number().int().min(0).max(MEAL_KCAL_MAX),
});
export const mealInputSchema = z.object({
  date: dateKeySchema,
  mealType: mealTypeSchema,
  name: z.string().trim().min(1).max(80),
  calories: z.number().int().min(0).max(MEAL_KCAL_MAX),
  source: mealSourceSchema.default('manual'),
  items: z.array(mealItemSchema).max(20).default([]),
  note: z.string().trim().max(200).default(''),
  /** Uploaded meal photo (see `POST /api/photos`). */
  photoId: z.uuid().nullable().default(null),
});
export const mealSchema = mealInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const dayStatusSchema = z.enum(['open', 'settled']);
export const daySummarySchema = z.object({
  date: dateKeySchema,
  status: dayStatusSchema,
  /** Whether meals for this day can still be added, edited or deleted. */
  editable: z.boolean(),
  targetKcal: z.number().int(),
  consumedKcal: z.number().int(),
  remainingKcal: z.number().int(),
  overKcal: z.number().int(),
  /** Confirmed when settled, provisional while the day is open. */
  donationYen: z.number().int(),
  donationYenPer100Kcal: z.number().int(),
});
export const dayDetailSchema = daySummarySchema.extend({
  meals: z.array(mealSchema),
});

export const donationEntrySchema = z.object({
  date: dateKeySchema,
  targetKcal: z.number().int(),
  consumedKcal: z.number().int(),
  overKcal: z.number().int(),
  donationYen: z.number().int(),
  donationYenPer100Kcal: z.number().int(),
  settledAt: z.string(),
});
export const donationTotalsSchema = z.object({
  totalYen: z.number().int(),
  totalOverKcal: z.number().int(),
  daysOver: z.number().int(),
  /** Provisional donation for days that are still open. */
  pendingYen: z.number().int(),
});
export const donationLedgerSchema = z.object({
  totals: donationTotalsSchema,
  entries: z.array(donationEntrySchema),
});

export const overviewSchema = z.object({
  today: dateKeySchema,
  profile: profileSchema.nullable(),
  day: dayDetailSchema.nullable(),
  totals: donationTotalsSchema.nullable(),
});
export const historySchema = z.object({
  days: z.array(daySummarySchema),
});

export const historyPeriodSchema = z.enum(['week', 'month', 'year']);
export const historyPeriodQuerySchema = z.object({
  period: historyPeriodSchema.default('week'),
  anchor: dateKeySchema.optional(),
});
const historyPeriodBase = {
  today: dateKeySchema,
  from: dateKeySchema,
  to: dateKeySchema,
  totals: z.object({
    loggedDays: z.number().int().nonnegative(),
    averageKcal: z.number().int().nonnegative().nullable(),
    donationYen: z.number().int().nonnegative(),
    pendingYen: z.number().int().nonnegative(),
  }),
};
export const historyDaySchema = daySummarySchema.extend({
  mealCount: z.number().int().nonnegative(),
});
export const historyMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  loggedDays: z.number().int().nonnegative(),
  averageKcal: z.number().int().nonnegative().nullable(),
  consumedKcal: z.number().int().nonnegative(),
  donationYen: z.number().int().nonnegative(),
  pendingYen: z.number().int().nonnegative(),
  status: z.enum(['complete', 'partial', 'future']),
});
export const periodHistorySchema = z.discriminatedUnion('granularity', [
  z.object({
    ...historyPeriodBase,
    granularity: z.literal('day'),
    period: z.enum(['week', 'month']),
    days: z.array(historyDaySchema),
  }),
  z.object({
    ...historyPeriodBase,
    granularity: z.literal('month'),
    period: z.literal('year'),
    months: z.array(historyMonthSchema).length(12),
  }),
]);
export type HistoryPeriod = z.infer<typeof historyPeriodSchema>;
export type HistoryPeriodQuery = z.input<typeof historyPeriodQuerySchema>;
export type HistoryDay = z.infer<typeof historyDaySchema>;
export type HistoryMonth = z.infer<typeof historyMonthSchema>;
export type PeriodHistory = z.infer<typeof periodHistorySchema>;

const mealTypeKcalSchema = z.object({
  breakfast: z.number().int(),
  lunch: z.number().int(),
  dinner: z.number().int(),
  snack: z.number().int(),
});
export const habitDaySchema = z.object({
  date: dateKeySchema,
  targetKcal: z.number().int(),
  consumedKcal: z.number().int(),
  overKcal: z.number().int(),
  donationYen: z.number().int(),
  mealCount: z.number().int(),
  byMealType: mealTypeKcalSchema,
});
export const habitStatsSchema = z.object({
  today: dateKeySchema,
  /** Oldest first. */
  days: z.array(habitDaySchema),
  streaks: z.object({
    /** Consecutive days with at least one meal logged, up to today. */
    currentLogging: z.number().int(),
    bestLogging: z.number().int(),
    /** Consecutive logged days at or under target, up to today. */
    currentWithinTarget: z.number().int(),
    bestWithinTarget: z.number().int(),
  }),
  summary: z.object({
    loggedDays: z.number().int(),
    withinTargetDays: z.number().int(),
    /** Share of logged days at or under target, 0–1. */
    achievementRate: z.number(),
    averageKcal: z.number().int(),
    donationYen: z.number().int(),
  }),
  /** Index 0 = Sunday. Averages over logged days. */
  weekdays: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      averageKcal: z.number().int(),
      loggedDays: z.number().int(),
    }),
  ),
  /** Average kcal per logged day for each meal type. */
  mealTypes: mealTypeKcalSchema,
});

export const imageMediaTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
/** 5 MB decoded image, the Claude API per-image limit. */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const photoUploadSchema = z.object({
  mediaType: z.enum(imageMediaTypes),
  /** Base64 without a `data:` prefix. */
  imageBase64: z
    .string()
    .min(1)
    .max(Math.ceil(IMAGE_MAX_BYTES / 3) * 4)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'imageBase64 must be base64'),
});
export const photoSchema = z.object({
  id: z.uuid(),
  contentType: z.enum(imageMediaTypes),
  byteSize: z.number().int(),
  createdAt: z.string(),
});
/** Estimate calories for a photo already uploaded with `POST /api/photos`. */
export const estimateRequestSchema = z.object({ photoId: z.uuid() });
export const estimateSchema = z.object({
  provider: z.enum(['claude', 'mock']),
  dishName: z.string(),
  items: z.array(mealItemSchema).min(1),
  totalCalories: z.number().int().min(0),
  confidence: z.enum(['low', 'medium', 'high']),
  notes: z.string(),
});

export type ProfileInput = z.input<typeof profileInputSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type MealType = z.infer<typeof mealTypeSchema>;
export type MealItem = z.infer<typeof mealItemSchema>;
export type MealInput = z.input<typeof mealInputSchema>;
export type Meal = z.infer<typeof mealSchema>;
export type DaySummary = z.infer<typeof daySummarySchema>;
export type DayDetail = z.infer<typeof dayDetailSchema>;
export type DonationEntry = z.infer<typeof donationEntrySchema>;
export type DonationTotals = z.infer<typeof donationTotalsSchema>;
export type DonationLedger = z.infer<typeof donationLedgerSchema>;
export type Overview = z.infer<typeof overviewSchema>;
export type History = z.infer<typeof historySchema>;
export type HabitDay = z.infer<typeof habitDaySchema>;
export type HabitStats = z.infer<typeof habitStatsSchema>;
export type PhotoUpload = z.infer<typeof photoUploadSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type EstimateRequest = z.infer<typeof estimateRequestSchema>;
export type Estimate = z.infer<typeof estimateSchema>;
export type Health = z.infer<typeof healthSchema>;
export type Echo = z.infer<typeof echoSchema>;
