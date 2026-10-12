'use client';
import { use, useEffect, useState } from 'react';
import { isEditableDay, type Meal } from '@calorie-donate/api';
import { MealEditor } from '@/components/MealEditor';
import { LoadError, Loading } from '@/components/PageState';
import { useOverview } from '@/components/useOverview';
import { api, errorMessage } from '@/lib/api';

export default function EditMealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { overview, error: overviewError, reload } = useOverview();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.meal(id).then(setMeal, (caught) => setError(errorMessage(caught)));
  }, [id]);

  const message = error ?? overviewError;
  if (message) {
    return <LoadError message={message} onRetry={() => void reload()} />;
  }
  if (!overview || !meal) return <Loading />;
  if (!isEditableDay(meal.date, overview.today)) {
    return (
      <div className="card">
        <p className="notice">
          この日は確定済みのため変更できません。記録・修正できるのは今日と昨日です。
        </p>
      </div>
    );
  }
  return (
    <>
      <h1>記録を編集</h1>
      <MealEditor
        today={overview.today}
        initialDate={meal.date}
        initialMode="manual"
        meal={meal}
      />
    </>
  );
}
