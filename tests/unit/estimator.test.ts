import { describe, expect, it, vi } from 'vitest';
import {
  createClaudeEstimator,
  createMockEstimator,
} from '../../apps/web/src/server/estimator';

type Anthropic = NonNullable<
  NonNullable<Parameters<typeof createClaudeEstimator>[0]>['client']
>;

const image = { mediaType: 'image/jpeg' as const, imageBase64: 'AAAA' };

const fakeClient = (response: unknown) => {
  const parse = vi.fn().mockResolvedValue(response);
  return {
    client: { beta: { messages: { parse } } } as unknown as Anthropic,
    parse,
  };
};

describe('photo calorie estimation', () => {
  it('sums and sanitizes Claude item estimates', async () => {
    const { client, parse } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: {
        isFood: true,
        dishName: ' 親子丼 ',
        items: [
          { name: '親子丼', calories: 680.4 },
          { name: '味噌汁', calories: 39.6 },
        ],
        confidence: 'medium',
        notes: '並盛りと仮定',
      },
    });
    const result = await createClaudeEstimator({ client }).estimate(image);
    expect(result).toEqual({
      provider: 'claude',
      dishName: '親子丼',
      items: [
        { name: '親子丼', calories: 680 },
        { name: '味噌汁', calories: 40 },
      ],
      totalCalories: 720,
      confidence: 'medium',
      notes: '並盛りと仮定',
    });
    const request = parse.mock.calls[0]?.[0];
    expect(request.model).toBe('claude-opus-5-5');
    expect(request.messages[0].content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' },
    });
  });

  it('reports photos without food', async () => {
    const { client } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: {
        isFood: false,
        dishName: '',
        items: [],
        confidence: 'low',
        notes: '',
      },
    });
    await expect(
      createClaudeEstimator({ client }).estimate(image),
    ).rejects.toMatchObject({ code: 'NOT_FOOD', status: 422 });
  });

  it('turns API failures and refusals into a retryable error', async () => {
    const failing = {
      beta: {
        messages: { parse: vi.fn().mockRejectedValue(new Error('down')) },
      },
    } as unknown as Anthropic;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      createClaudeEstimator({ client: failing }).estimate(image),
    ).rejects.toMatchObject({ code: 'ESTIMATION_FAILED', status: 502 });
    const { client } = fakeClient({
      stop_reason: 'refusal',
      parsed_output: null,
    });
    await expect(
      createClaudeEstimator({ client }).estimate(image),
    ).rejects.toMatchObject({ code: 'ESTIMATION_FAILED' });
  });

  it('returns a labelled, deterministic sample without an API key', async () => {
    const estimator = createMockEstimator();
    const first = await estimator.estimate(image);
    expect(first.provider).toBe('mock');
    expect(first.totalCalories).toBe(
      first.items.reduce((sum, item) => sum + item.calories, 0),
    );
    await expect(estimator.estimate(image)).resolves.toEqual(first);
  });
});
