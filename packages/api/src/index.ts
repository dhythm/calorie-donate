import { z } from 'zod';

export const healthSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('calorie-donate-api'),
});
export const echoSchema = z.object({
  message: z.string().trim().min(1).max(200),
});
export const apiErrorSchema = z.object({
  error: z.object({ code: z.literal('INVALID_REQUEST'), message: z.string() }),
});
export type Health = z.infer<typeof healthSchema>;
export type Echo = z.infer<typeof echoSchema>;
type ErrorKind =
  'configuration' | 'network' | 'timeout' | 'http' | 'invalid-response';
export class ApiClientError extends Error {
  constructor(
    public readonly kind: ErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

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
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
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
  return {
    health: (): Promise<Health> => request('/api/health', healthSchema),
    echo: (input: Echo): Promise<Echo> =>
      request('/api/echo', echoSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(echoSchema.parse(input)),
      }),
  };
}
