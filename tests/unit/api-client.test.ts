import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, createApiClient } from '../../packages/api/src/index';

const mockFetch = (response: Response) =>
  vi.fn<typeof fetch>().mockResolvedValue(response);
describe('shared browser/native API client', () => {
  it('uses the native origin and validates the live contract shape', async () => {
    const fetcher = mockFetch(
      Response.json({ status: 'ok', service: 'calorie-donate-api' }),
    );
    await expect(
      createApiClient({ baseUrl: 'http://10.0.2.2:3000/', fetcher }).health(),
    ).resolves.toEqual({ status: 'ok', service: 'calorie-donate-api' });
    expect(fetcher).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it('uses same-origin URLs in the browser and sends validated JSON', async () => {
    const fetcher = mockFetch(Response.json({ message: 'hello' }));
    await createApiClient({ baseUrl: '', fetcher }).echo({
      message: '  hello  ',
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/echo',
      expect.objectContaining({
        method: 'POST',
        body: '{"message":"hello"}',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  it.each([
    'not-a-url',
    'file:///tmp/api',
    'http://user:secret@localhost:3000',
    'http://localhost:3000/api',
    'http://localhost:3000?token=secret',
  ])('rejects misconfigured native origins: %s', (baseUrl) => {
    expect(() => createApiClient({ baseUrl })).toThrow(ApiClientError);
  });
  it.each([
    Response.json({ status: 'ok', service: 'other-api' }),
    new Response('<html>proxy error</html>', { status: 200 }),
  ])('rejects incompatible or non-JSON success responses', async (response) => {
    await expect(
      createApiClient({ baseUrl: '', fetcher: mockFetch(response) }).health(),
    ).rejects.toMatchObject({ kind: 'invalid-response' });
  });
  it('preserves structured API errors and status for the UI', async () => {
    const response = Response.json(
      { error: { code: 'INVALID_REQUEST', message: 'Invalid input' } },
      { status: 400 },
    );
    await expect(
      createApiClient({ baseUrl: '', fetcher: mockFetch(response) }).health(),
    ).rejects.toMatchObject({
      kind: 'http',
      status: 400,
      message: 'Invalid input',
    });
  });
  it('handles a proxy error without leaking raw HTML', async () => {
    await expect(
      createApiClient({
        baseUrl: '',
        fetcher: mockFetch(
          new Response('<html>secret</html>', { status: 502 }),
        ),
      }).health(),
    ).rejects.toMatchObject({
      kind: 'http',
      status: 502,
      message: 'API returned HTTP 502.',
    });
  });
  it('distinguishes an unreachable server from HTTP failure', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(
      createApiClient({ baseUrl: '', fetcher }).health(),
    ).rejects.toMatchObject({ kind: 'network' });
  });
  it('aborts stalled requests and clears the timeout', async () => {
    vi.useFakeTimers();
    try {
      const fetcher: typeof fetch = (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          );
        });
      const result = expect(
        createApiClient({ baseUrl: '', fetcher, timeoutMs: 100 }).health(),
      ).rejects.toMatchObject({ kind: 'timeout' });
      await vi.advanceTimersByTimeAsync(100);
      await result;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
