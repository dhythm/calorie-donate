import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Estimate, EstimateRequest } from '@calorie-donate/api';
import { ServiceError } from './service';

export interface CalorieEstimator {
  estimate(image: EstimateRequest): Promise<Estimate>;
}

const DEFAULT_MODEL = 'claude-opus-5-5';

const visionResultSchema = z.object({
  isFood: z.boolean(),
  dishName: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      calories: z.number(),
    }),
  ),
  confidence: z.enum(['low', 'medium', 'high']),
  notes: z.string(),
});

const SYSTEM_PROMPT = `あなたは管理栄養士として、食事の写真から摂取カロリーを推定します。
写っている料理・飲み物を品目ごとに分け、一般的な一人前の量と写真から読み取れる量（皿の大きさ、残り具合）を考慮して kcal を整数で推定してください。
- dishName: 食事全体を表す短い日本語名（例: 「鮭定食」）
- items: 品目ごとの日本語名と kcal。同じ料理を重複させない
- confidence: 量や料理の判別が難しいほど low
- notes: 推定の前提（量の仮定、見えない調味料など）を日本語で一文
食べ物が写っていない場合は isFood を false にし、items は空にしてください。`;

/** Claude vision estimator. Used when ANTHROPIC_API_KEY is configured. */
export function createClaudeEstimator({
  client = new Anthropic(),
  model = process.env.CALORIE_ESTIMATOR_MODEL || DEFAULT_MODEL,
}: { client?: Anthropic; model?: string } = {}): CalorieEstimator {
  return {
    async estimate(image) {
      let response;
      try {
        response = await client.beta.messages.parse({
          model,
          max_tokens: 4000,
          // Refusals on food photos are rare; route them to another model
          // instead of failing the user's upload.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: {
            effort: 'low',
            format: betaZodOutputFormat(visionResultSchema),
          },
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: image.mediaType,
                    data: image.imageBase64,
                  },
                },
                {
                  type: 'text',
                  text: 'この食事のカロリーを推定してください。',
                },
              ],
            },
          ],
        });
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          console.error(
            'Claude estimation failed',
            error.status,
            error.message,
          );
        } else {
          console.error('Claude estimation failed', error);
        }
        throw new ServiceError(
          'ESTIMATION_FAILED',
          502,
          'Calorie estimation is unavailable. Try again or enter it manually.',
        );
      }
      const result = response.parsed_output;
      if (response.stop_reason === 'refusal' || !result) {
        throw new ServiceError(
          'ESTIMATION_FAILED',
          502,
          'Could not estimate this photo. Enter the calories manually.',
        );
      }
      if (!result.isFood) {
        throw new ServiceError(
          'NOT_FOOD',
          422,
          'No food was found in the photo.',
        );
      }
      const { dishName, items, confidence, notes } = result;
      return normalize({
        provider: 'claude',
        dishName,
        items,
        confidence,
        notes,
      });
    },
  };
}

/**
 * Deterministic stand-in so the photo flow works without an API key
 * (local development, CI, demos). Results are labelled `mock`.
 */
export function createMockEstimator(): CalorieEstimator {
  const samples = [
    {
      dishName: '鮭の塩焼き定食（サンプル）',
      items: [
        { name: 'ごはん（並）', calories: 252 },
        { name: '鮭の塩焼き', calories: 180 },
        { name: '味噌汁', calories: 40 },
        { name: 'ほうれん草のおひたし', calories: 25 },
      ],
    },
    {
      dishName: 'カレーライス（サンプル）',
      items: [
        { name: 'カレーライス', calories: 750 },
        { name: 'サラダ', calories: 60 },
      ],
    },
    {
      dishName: 'サンドイッチとカフェラテ（サンプル）',
      items: [
        { name: 'ミックスサンドイッチ', calories: 380 },
        { name: 'カフェラテ（M）', calories: 150 },
      ],
    },
  ];
  return {
    async estimate(image) {
      let hash = 0;
      for (const char of image.imageBase64.slice(0, 2048)) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
      }
      const sample = samples[hash % samples.length] ?? samples[0]!;
      return normalize({
        provider: 'mock',
        ...sample,
        confidence: 'low',
        notes:
          'ANTHROPIC_API_KEY が未設定のため、写真を解析せずにサンプル値を返しています。',
      });
    },
  };
}

function normalize(
  estimate: Omit<Estimate, 'totalCalories'> & {
    items: { name: string; calories: number }[];
  },
): Estimate {
  const items = estimate.items
    .map((item) => ({
      name: item.name.trim().slice(0, 80) || '不明な品目',
      calories: Math.min(10_000, Math.max(0, Math.round(item.calories))),
    }))
    .slice(0, 20);
  if (items.length === 0) {
    throw new ServiceError(
      'ESTIMATION_FAILED',
      502,
      'Could not estimate this photo. Enter the calories manually.',
    );
  }
  return {
    ...estimate,
    dishName: estimate.dishName.trim().slice(0, 80) || items[0]!.name,
    items,
    totalCalories: items.reduce((sum, item) => sum + item.calories, 0),
  };
}

export function createEstimator(): CalorieEstimator {
  if (
    process.env.CALORIE_ESTIMATOR === 'mock' ||
    !process.env.ANTHROPIC_API_KEY
  ) {
    return createMockEstimator();
  }
  return createClaudeEstimator();
}
