import { z } from 'zod';
import {
  apiErrorSchema,
  dayDetailSchema,
  donationLedgerSchema,
  echoSchema,
  estimateRequestSchema,
  estimateSchema,
  healthSchema,
  historySchema,
  mealInputSchema,
  mealSchema,
  overviewSchema,
  profileInputSchema,
  profileSchema,
  type ApiErrorCode,
  type DayDetail,
  type DonationLedger,
  type Echo,
  type Estimate,
  type EstimateRequest,
  type Health,
  type History,
  type Meal,
  type MealInput,
  type Overview,
  type Profile,
  type ProfileInput,
} from './schemas';

type ErrorKind =
  'configuration' | 'network' | 'timeout' | 'http' | 'invalid-response';
export class ApiClientError extends Error {
  constructor(
    public readonly kind: ErrorKind,
    message: string,
    public readonly status?: number,
    public readonly code?: ApiErrorCode,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** Photo estimation calls a vision model, so it gets a longer budget. */
const ESTIMATE_TIMEOUT_MS = 60_000;
const deletedSchema = z.object({ deleted: z.literal(true) });

/** Browser: empty same-origin base. Native: explicit HTTP(S) server origin. */
export function createApiClient({
  baseUrl,
  timeoutMs = 10_000,
  fetcher = fetch,
}: {
  baseUrl: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}) {
  if (baseUrl !== '') {
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new ApiClientError(
        'configuration',
        'API URL must be an HTTP(S) origin.',
      );
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new ApiClientError(
        'configuration',
        'API URL must be an HTTP(S) origin.',
      );
    }
    baseUrl = url.origin;
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ApiClientError(
      'configuration',
      'Timeout must be a positive number.',
    );
  }
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    init?: RequestInit,
    requestTimeoutMs = timeoutMs,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetcher(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = apiErrorSchema.safeParse(body);
        throw new ApiClientError(
          'http',
          error.success
            ? error.data.error.message
            : `API returned HTTP ${response.status}.`,
          response.status,
          error.success ? error.data.error.code : undefined,
        );
      }
      const result = schema.safeParse(body);
      if (!result.success) {
        throw new ApiClientError(
          'invalid-response',
          'API returned an unexpected response.',
        );
      }
      return result.data;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ApiClientError('timeout', 'API request timed out.');
      }
      if (error instanceof ApiClientError) {
        throw error;
      }
      throw new ApiClientError(
        'network',
        'Could not reach the API. Check the server and API URL.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    health: (): Promise<Health> => request('/api/health', healthSchema),
    echo: (input: Echo): Promise<Echo> =>
      request('/api/echo', echoSchema, json('POST', echoSchema.parse(input))),
    /** Profile, the given day (default: today) and donation totals. */
    overview: (date?: string): Promise<Overview> =>
      request(
        `/api/overview${date ? `?date=${encodeURIComponent(date)}` : ''}`,
        overviewSchema,
      ),
    saveProfile: (input: ProfileInput): Promise<Profile> =>
      request(
        '/api/profile',
        profileSchema,
        json('PUT', profileInputSchema.parse(input)),
      ),
    day: (date: string): Promise<DayDetail> =>
      request(`/api/days/${encodeURIComponent(date)}`, dayDetailSchema),
    history: (days = 14): Promise<History> =>
      request(`/api/history?days=${days}`, historySchema),
    createMeal: (input: MealInput): Promise<Meal> =>
      request(
        '/api/meals',
        mealSchema,
        json('POST', mealInputSchema.parse(input)),
      ),
    updateMeal: (id: string, input: MealInput): Promise<Meal> =>
      request(
        `/api/meals/${encodeURIComponent(id)}`,
        mealSchema,
        json('PUT', mealInputSchema.parse(input)),
      ),
    meal: (id: string): Promise<Meal> =>
      request(`/api/meals/${encodeURIComponent(id)}`, mealSchema),
    deleteMeal: async (id: string): Promise<void> => {
      await request(`/api/meals/${encodeURIComponent(id)}`, deletedSchema, {
        method: 'DELETE',
      });
    },
    estimateMeal: (input: EstimateRequest): Promise<Estimate> =>
      request(
        '/api/meals/estimate',
        estimateSchema,
        json('POST', estimateRequestSchema.parse(input)),
        Math.max(timeoutMs, ESTIMATE_TIMEOUT_MS),
      ),
    donations: (): Promise<DonationLedger> =>
      request('/api/donations', donationLedgerSchema),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
