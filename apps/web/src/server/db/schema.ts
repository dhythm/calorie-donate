import { sql } from 'drizzle-orm';
import {
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { MealItem } from '@calorie-donate/api';

/** Raw image bytes. node-postgres returns a Buffer, PGlite a Uint8Array. */
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
});

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

// Every row carries user_id so accounts can be added without reshaping data.
// Until then the app uses a single local user.

export const profiles = pgTable('profiles', {
  userId: text('user_id').primaryKey(),
  displayName: text('display_name').notNull().default(''),
  dailyTargetKcal: integer('daily_target_kcal').notNull(),
  donationYenPer100Kcal: integer('donation_yen_per_100_kcal').notNull(),
  timeZone: text('time_zone').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const mealPhotos = pgTable(
  'meal_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    data: bytea('data').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('meal_photos_user_created_idx').on(table.userId, table.createdAt),
  ],
);

export const meals = pgTable(
  'meals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    mealType: text('meal_type').notNull(),
    name: text('name').notNull(),
    calories: integer('calories').notNull(),
    source: text('source').notNull(),
    items: jsonb('items')
      .$type<MealItem[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    note: text('note').notNull().default(''),
    photoId: uuid('photo_id').references(() => mealPhotos.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('meals_user_date_idx').on(table.userId, table.date)],
);

/** One row per closed day: the donation ledger. */
export const settlements = pgTable(
  'settlements',
  {
    userId: text('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    targetKcal: integer('target_kcal').notNull(),
    consumedKcal: integer('consumed_kcal').notNull(),
    overKcal: integer('over_kcal').notNull(),
    donationYen: integer('donation_yen').notNull(),
    donationYenPer100Kcal: integer('donation_yen_per_100_kcal').notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.date] })],
);
