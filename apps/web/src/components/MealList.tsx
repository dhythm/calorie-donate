'use client';
import Link from 'next/link';
import {
  formatKcal,
  mealTypeLabels,
  mealTypes,
  type Meal,
} from '@calorie-donate/api';
import { api } from '@/lib/api';

export function MealList({
  meals,
  editable,
  onDelete,
}: {
  meals: Meal[];
  editable: boolean;
  onDelete: (meal: Meal) => void;
}) {
  if (meals.length === 0) {
    return <p className="empty">まだ記録がありません。</p>;
  }
  return (
    <div className="meal-groups">
      {mealTypes
        .map((type) => ({
          type,
          meals: meals.filter((meal) => meal.mealType === type),
        }))
        .filter((group) => group.meals.length > 0)
        .map((group) => (
          <section key={group.type} className="meal-group">
            <h3>
              {mealTypeLabels[group.type]}
              <span>
                {formatKcal(
                  group.meals.reduce((sum, meal) => sum + meal.calories, 0),
                )}
              </span>
            </h3>
            <ul>
              {group.meals.map((meal) => (
                <li key={meal.id} className="meal-row">
                  <div className="meal-with-thumb">
                    {meal.photoId && (
                      // eslint-disable-next-line @next/next/no-img-element -- photo served by the API
                      <img
                        src={api.photoUrl(meal.photoId)}
                        alt=""
                        className="meal-thumb"
                        loading="lazy"
                      />
                    )}
                    <div className="meal-main">
                      <span className="meal-name">
                        {meal.source === 'photo' && (
                          <span className="badge" title="写真から推定">
                            写真
                          </span>
                        )}
                        {meal.name}
                      </span>
                      {meal.items.length > 0 && (
                        <span className="meal-items">
                          {meal.items.map((item) => item.name).join('・')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="meal-kcal">{formatKcal(meal.calories)}</span>
                  {editable && (
                    <span className="meal-actions">
                      <Link
                        href={`/meals/${meal.id}`}
                        className="icon-button"
                        aria-label={`${meal.name}を編集`}
                      >
                        編集
                      </Link>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => onDelete(meal)}
                        aria-label={`${meal.name}を削除`}
                      >
                        削除
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
