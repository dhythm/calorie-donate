'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { isEditableDay } from '@calorie-donate/api';
import { MealEditor } from '@/components/MealEditor';
import { LoadError, Loading, NeedsProfile } from '@/components/PageState';
import { useOverview } from '@/components/useOverview';

export default function NewMealPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewMeal />
    </Suspense>
  );
}

function NewMeal() {
  const params = useSearchParams();
  const { overview, error, reload } = useOverview();
  if (error) return <LoadError message={error} onRetry={() => void reload()} />;
  if (!overview) return <Loading />;
  if (!overview.profile) return <NeedsProfile />;
  const requested = params.get('date');
  const date =
    requested && isEditableDay(requested, overview.today)
      ? requested
      : overview.today;
  return (
    <>
      <h1>食事を記録</h1>
      <MealEditor
        today={overview.today}
        initialDate={date}
        initialMode={params.get('mode') === 'photo' ? 'photo' : 'manual'}
      />
    </>
  );
}
