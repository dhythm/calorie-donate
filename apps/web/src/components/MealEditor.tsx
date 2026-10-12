'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  MEAL_KCAL_MAX,
  addDays,
  formatDateLabel,
  formatKcal,
  mealTypeLabels,
  mealTypes,
  suggestMealType,
  type Estimate,
  type Meal,
  type MealType,
} from '@calorie-donate/api';
import { api, errorMessage } from '@/lib/api';
import { prepareImage } from '@/lib/image';

type Mode = 'photo' | 'manual';
type ItemDraft = { key: number; name: string; calories: string };

const confidenceLabels = { low: '低', medium: '中', high: '高' } as const;
let nextKey = 0;
const draft = (name = '', calories = ''): ItemDraft => ({
  key: nextKey++,
  name,
  calories,
});

const toInt = (value: string) => {
  const number = Number(value);
  return value.trim() !== '' && Number.isInteger(number) ? number : NaN;
};

export function MealEditor({
  today,
  initialDate,
  initialMode,
  meal,
}: {
  today: string;
  initialDate: string;
  initialMode: Mode;
  meal?: Meal;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>(meal ? 'manual' : initialMode);
  const [date, setDate] = useState(meal?.date ?? initialDate);
  const [mealType, setMealType] = useState<MealType>(
    meal?.mealType ?? suggestMealType(new Date().getHours()),
  );
  const [name, setName] = useState(meal?.name ?? '');
  const [calories, setCalories] = useState(meal ? String(meal.calories) : '');
  const [items, setItems] = useState<ItemDraft[]>(
    meal?.items.map((item) => draft(item.name, String(item.calories))) ?? [],
  );
  const [note, setNote] = useState(meal?.note ?? '');
  const [source, setSource] = useState<Meal['source']>(
    meal?.source ?? 'manual',
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemTotal = items.reduce(
    (sum, item) => sum + (toInt(item.calories) || 0),
    0,
  );
  const usesItems = items.length > 0;
  const total = usesItems ? itemTotal : toInt(calories);
  const itemsValid = items.every(
    (item) =>
      item.name.trim() !== '' &&
      toInt(item.calories) >= 0 &&
      toInt(item.calories) <= MEAL_KCAL_MAX,
  );
  const valid =
    name.trim() !== '' &&
    Number.isInteger(total) &&
    total >= 0 &&
    total <= MEAL_KCAL_MAX &&
    itemsValid;
  const showForm = mode === 'manual' || estimate !== null;
  const dates = [today, addDays(today, -1)];

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setEstimate(null);
    setEstimating(true);
    let image;
    try {
      image = await prepareImage(file);
    } catch {
      setEstimating(false);
      setError('この画像は読み込めませんでした。別の写真を選んでください。');
      return;
    }
    setPreview(image.previewUrl);
    try {
      const result = await api.estimateMeal({
        mediaType: image.mediaType,
        imageBase64: image.imageBase64,
      });
      setEstimate(result);
      setName(result.dishName);
      setItems(
        result.items.map((item) => draft(item.name, String(item.calories))),
      );
      setNote(result.notes);
      setSource('photo');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setEstimating(false);
    }
  }

  function updateItem(key: number, patch: Partial<ItemDraft>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    const input = {
      date,
      mealType,
      name: name.trim(),
      calories: total,
      source,
      note: note.trim(),
      items: items.map((item) => ({
        name: item.name.trim(),
        calories: toInt(item.calories),
      })),
    };
    try {
      if (meal) {
        await api.updateMeal(meal.id, input);
      } else {
        await api.createMeal(input);
      }
      router.push(date === today ? '/' : `/?date=${date}`);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      {!meal && (
        <div className="segmented" role="tablist" aria-label="記録方法">
          {(['photo', 'manual'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                setError(null);
              }}
            >
              {value === 'photo' ? '写真で推定' : '手入力'}
            </button>
          ))}
        </div>
      )}

      {mode === 'photo' && !meal && (
        <section className="card photo-card">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="visually-hidden"
            onChange={onFile}
            aria-label="食事の写真を選択"
            data-testid="photo-input"
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
            <img
              src={preview}
              alt="選択した食事の写真"
              className="photo-preview"
            />
          ) : (
            <div className="photo-placeholder" aria-hidden="true">
              📷
            </div>
          )}
          <p className="hint">
            食事の写真を撮るか選ぶと、サーバーでカロリーを推定します。結果は保存前に修正できます。
          </p>
          <button
            type="button"
            className="button primary"
            onClick={() => fileInput.current?.click()}
            disabled={estimating}
          >
            {estimating
              ? '推定中…'
              : preview
                ? '別の写真を選ぶ'
                : '写真を撮る・選ぶ'}
          </button>
          {estimating && (
            <p role="status" className="hint">
              写真を解析しています…
            </p>
          )}
          {estimate && (
            <div className="estimate" role="status">
              <p>
                推定: <strong>{formatKcal(estimate.totalCalories)}</strong>
                （確からしさ: {confidenceLabels[estimate.confidence]}）
              </p>
              {estimate.provider === 'mock' && (
                <p className="notice warning">
                  サンプル推定です（サーバーに ANTHROPIC_API_KEY
                  が未設定のため、写真は解析していません）。
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}

      {showForm && (
        <form className="card form" onSubmit={save} noValidate>
          <fieldset className="field">
            <legend className="field-label">日付</legend>
            <div className="chips">
              {dates.map((value) => (
                <label key={value} className="chip">
                  <input
                    type="radio"
                    name="date"
                    value={value}
                    checked={date === value}
                    onChange={() => setDate(value)}
                  />
                  {formatDateLabel(value, today)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="field">
            <legend className="field-label">食事の種類</legend>
            <div className="chips">
              {mealTypes.map((value) => (
                <label key={value} className="chip">
                  <input
                    type="radio"
                    name="mealType"
                    value={value}
                    checked={mealType === value}
                    onChange={() => setMealType(value)}
                  />
                  {mealTypeLabels[value]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span className="field-label">料理名</span>
            <input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 鮭おにぎり"
              required
            />
          </label>

          {usesItems ? (
            <fieldset className="field">
              <legend className="field-label">品目ごとのカロリー</legend>
              <ul className="item-list">
                {items.map((item, index) => (
                  <li key={item.key} className="item-row">
                    <input
                      value={item.name}
                      maxLength={80}
                      onChange={(e) =>
                        updateItem(item.key, { name: e.target.value })
                      }
                      aria-label={`品目 ${index + 1} の名前`}
                    />
                    <span className="input-unit">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MEAL_KCAL_MAX}
                        value={item.calories}
                        onChange={(e) =>
                          updateItem(item.key, { calories: e.target.value })
                        }
                        aria-label={`品目 ${index + 1} のカロリー`}
                      />
                      <span>kcal</span>
                    </span>
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() =>
                        setItems((current) =>
                          current.filter((other) => other.key !== item.key),
                        )
                      }
                      aria-label={`品目 ${index + 1} を削除`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="button ghost"
                onClick={() => setItems((current) => [...current, draft()])}
              >
                品目を追加
              </button>
              <p className="total">
                合計{' '}
                <strong data-testid="meal-total">
                  {formatKcal(itemTotal)}
                </strong>
              </p>
            </fieldset>
          ) : (
            <div className="field">
              <label className="field-label" htmlFor="meal-calories">
                カロリー
              </label>
              <span className="input-unit">
                <input
                  id="meal-calories"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MEAL_KCAL_MAX}
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  required
                />
                <span>kcal</span>
              </span>
              <button
                type="button"
                className="link-button"
                onClick={() => setItems([draft(name, calories)])}
              >
                品目ごとに入力する
              </button>
            </div>
          )}

          <label className="field">
            <span className="field-label">メモ（任意）</span>
            <textarea
              value={note}
              maxLength={200}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="actions">
            <button
              type="submit"
              className="button primary"
              disabled={!valid || saving}
            >
              {saving ? '保存中…' : meal ? '変更を保存' : '記録する'}
            </button>
            <button
              type="button"
              className="button ghost"
              onClick={() => router.back()}
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
