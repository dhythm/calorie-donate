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

export const imageMediaTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
/** 5 MB decoded image, the Claude API per-image limit. */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const estimateRequestSchema = z.object({
  mediaType: z.enum(imageMediaTypes),
  /** Base64 without a `data:` prefix. */
  imageBase64: z
    .string()
    .min(1)
    .max(Math.ceil(IMAGE_MAX_BYTES / 3) * 4)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'imageBase64 must be base64'),
});
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
export type EstimateRequest = z.infer<typeof estimateRequestSchema>;
export type Estimate = z.infer<typeof estimateSchema>;
export type Health = z.infer<typeof healthSchema>;
export type Echo = z.infer<typeof echoSchema>;
