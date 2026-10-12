import { formatKcal, progressRatio } from '@calorie-donate/api';

/** Circular gauge of consumed vs target; turns red once over target. */
export function ProgressRing({
  consumedKcal,
  targetKcal,
}: {
  consumedKcal: number;
  targetKcal: number;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const ratio = progressRatio(consumedKcal, targetKcal);
  const over = consumedKcal > targetKcal;
  return (
    <div className="ring" data-over={over}>
      <svg
        viewBox="0 0 128 128"
        role="img"
        aria-label={`目標 ${formatKcal(targetKcal)} のうち ${formatKcal(consumedKcal)} 摂取`}
      >
        <circle className="ring-track" cx="64" cy="64" r={radius} />
        <circle
          className="ring-value"
          cx="64"
          cy="64"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform="rotate(-90 64 64)"
        />
      </svg>
      <div className="ring-label">
        <span className="ring-number">
          {consumedKcal.toLocaleString('ja-JP')}
        </span>
        <span className="ring-unit">/ {formatKcal(targetKcal)}</span>
      </div>
    </div>
  );
}
