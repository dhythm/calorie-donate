'use client';
import { useState } from 'react';
import {
  formatDateLabel,
  formatKcal,
  formatYen,
  mealTypeLabels,
  mealTypes,
  weekdayLabels,
  type HabitDay,
  type HabitStats,
} from '@calorie-donate/api';

// Validated pair (dataviz validator, light surface): within target / over.
const WITHIN = '#199e70';
const OVER = '#e0602f';

type Tip = { x: number; y: number; title: string; lines: string[] } | null;

function useTooltip() {
  const [tip, setTip] = useState<Tip>(null);
  const show =
    (title: string, lines: string[]) =>
    (event: React.PointerEvent<Element> | React.FocusEvent<Element>) => {
      const target = event.currentTarget.getBoundingClientRect();
      const frame = event.currentTarget
        .closest('.chart')
        ?.getBoundingClientRect();
      if (!frame) return;
      setTip({
        x: target.left - frame.left + target.width / 2,
        y: target.top - frame.top,
        title,
        lines,
      });
    };
  const hide = () => setTip(null);
  const node = tip && (
    <div
      className="chart-tip"
      role="status"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.lines.map((line, i) => (
        <span key={i} className={i === 0 ? 'chart-tip-value' : undefined}>
          {line}
        </span>
      ))}
      <span className="chart-tip-label">{tip.title}</span>
    </div>
  );
  return { show, hide, node };
}

const niceMax = (value: number) => {
  const step = value > 3000 ? 1000 : 500;
  return Math.max(step, Math.ceil(value / step) * step);
};

const dayLines = (day: HabitDay) =>
  day.mealCount === 0
    ? ['記録なし']
    : [
        formatKcal(day.consumedKcal),
        day.overKcal > 0
          ? `目標を ${formatKcal(day.overKcal)} 超過・${formatYen(day.donationYen)}`
          : `目標 ${formatKcal(day.targetKcal)} 以内`,
      ];

function Legend() {
  return (
    <div className="legend" aria-hidden="true">
      <span>
        <i style={{ background: WITHIN }} />
        目標以内
      </span>
      <span>
        <i style={{ background: OVER }} />
        目標超過
      </span>
      <span>
        <i className="legend-line" />
        目標
      </span>
    </div>
  );
}

/** Daily intake columns against the target line. */
export function DailyChart({
  stats,
  days = 30,
}: {
  stats: HabitStats;
  days?: number;
}) {
  const { show, hide, node } = useTooltip();
  const data = stats.days.slice(-days);
  const width = 640;
  const height = 200;
  const pad = { top: 12, right: 8, bottom: 22, left: 40 };
  const max = niceMax(
    Math.max(...data.map((d) => Math.max(d.consumedKcal, d.targetKcal))),
  );
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / data.length;
  const barW = Math.min(16, slot - 2);
  const y = (kcal: number) => pad.top + plotH - (kcal / max) * plotH;
  const ticks = [0, max / 2, max];
  const target = data.at(-1)?.targetKcal ?? 0;
  return (
    <figure className="chart">
      <figcaption>
        <h3>毎日の摂取カロリー</h3>
        <p className="hint">
          直近 {days} 日。棒にカーソルを合わせると詳細を表示します。
        </p>
      </figcaption>
      <Legend />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        role="img"
        aria-label={`直近${days}日の摂取カロリーと目標`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              className="grid"
            />
            <text
              x={pad.left - 6}
              y={y(tick) + 4}
              className="axis"
              textAnchor="end"
            >
              {tick >= 1000 ? `${tick / 1000}K` : tick}
            </text>
          </g>
        ))}
        {data.map((day, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const h = Math.max(0, plotH - (y(day.consumedKcal) - pad.top));
          const r = Math.min(4, h / 2, barW / 2);
          const top = y(day.consumedKcal);
          const base = pad.top + plotH;
          const title = formatDateLabel(day.date, stats.today);
          return (
            <g key={day.date}>
              {h > 0 && (
                <path
                  d={`M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`}
                  fill={day.overKcal > 0 ? OVER : WITHIN}
                />
              )}
              {i % 7 === (data.length - 1) % 7 && (
                <text
                  x={x + barW / 2}
                  y={height - 6}
                  className="axis"
                  textAnchor="middle"
                >
                  {Number(day.date.slice(8))}
                </text>
              )}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={plotH}
                className="hit"
                tabIndex={0}
                aria-label={`${title} ${dayLines(day).join('、')}`}
                onPointerEnter={show(title, dayLines(day))}
                onFocus={show(title, dayLines(day))}
                onPointerLeave={hide}
                onBlur={hide}
              />
            </g>
          );
        })}
        {target > 0 && (
          <g>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(target)}
              y2={y(target)}
              className="target-line"
            />
            <text
              x={width - pad.right}
              y={y(target) - 4}
              className="axis target-label"
              textAnchor="end"
            >
              目標 {target.toLocaleString('ja-JP')}
            </text>
          </g>
        )}
      </svg>
      {node}
    </figure>
  );
}

/** Calendar of the last weeks: one cell per day, colored by outcome. */
export function HabitCalendar({ stats }: { stats: HabitStats }) {
  const { show, hide, node } = useTooltip();
  // Start on a Sunday so each column is one week.
  const first = new Date(`${stats.days[0]!.date}T00:00:00Z`).getUTCDay();
  const cells: (HabitDay | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...stats.days,
  ];
  const weeks: (HabitDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <figure className="chart">
      <figcaption>
        <h3>習慣カレンダー</h3>
        <p className="hint">
          直近 {Math.ceil(stats.days.length / 7)}{' '}
          週間。記録した日と目標を守れた日。
        </p>
      </figcaption>
      <div className="legend" aria-hidden="true">
        <span>
          <i style={{ background: WITHIN }} />
          目標以内
        </span>
        <span>
          <i style={{ background: OVER }} />
          目標超過
        </span>
        <span>
          <i className="legend-empty" />
          記録なし
        </span>
      </div>
      <div className="calendar" role="grid" aria-label="習慣カレンダー">
        <div className="calendar-labels" aria-hidden="true">
          {weekdayLabels.map((label, i) => (
            <span key={label}>{i % 2 === 1 ? label : ''}</span>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={w} className="calendar-week" role="row">
            {week.map((day, d) =>
              day ? (
                <span
                  key={day.date}
                  role="gridcell"
                  tabIndex={0}
                  className="calendar-cell"
                  data-state={
                    day.mealCount === 0
                      ? 'empty'
                      : day.overKcal > 0
                        ? 'over'
                        : 'within'
                  }
                  data-today={day.date === stats.today || undefined}
                  style={{
                    background:
                      day.mealCount === 0
                        ? undefined
                        : day.overKcal > 0
                          ? OVER
                          : WITHIN,
                  }}
                  aria-label={`${formatDateLabel(day.date, stats.today)} ${dayLines(day).join('、')}`}
                  onPointerEnter={show(
                    formatDateLabel(day.date, stats.today),
                    dayLines(day),
                  )}
                  onFocus={show(
                    formatDateLabel(day.date, stats.today),
                    dayLines(day),
                  )}
                  onPointerLeave={hide}
                  onBlur={hide}
                />
              ) : (
                <span
                  key={`pad-${d}`}
                  className="calendar-cell pad"
                  aria-hidden="true"
                />
              ),
            )}
          </div>
        ))}
      </div>
      {node}
    </figure>
  );
}

/** Horizontal bars for averages (weekday or meal type), one series. */
function AverageBars({
  title,
  hint,
  rows,
  reference,
}: {
  title: string;
  hint: string;
  rows: { label: string; value: number; detail: string }[];
  reference?: number;
}) {
  const { show, hide, node } = useTooltip();
  const max = niceMax(Math.max(reference ?? 0, ...rows.map((r) => r.value)));
  return (
    <figure className="chart">
      <figcaption>
        <h3>{title}</h3>
        <p className="hint">{hint}</p>
      </figcaption>
      <ul className="hbars">
        {rows.map((row) => (
          <li
            key={row.label}
            tabIndex={0}
            onPointerEnter={show(row.label, [
              formatKcal(row.value),
              row.detail,
            ])}
            onFocus={show(row.label, [formatKcal(row.value), row.detail])}
            onPointerLeave={hide}
            onBlur={hide}
          >
            <span className="hbar-label">{row.label}</span>
            <span className="hbar-track">
              <span
                className="hbar-fill"
                style={{ width: `${(row.value / max) * 100}%` }}
              />
              {reference !== undefined && (
                <span
                  className="hbar-ref"
                  style={{ left: `${(reference / max) * 100}%` }}
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="hbar-value">
              {row.value > 0 ? row.value.toLocaleString('ja-JP') : '—'}
            </span>
          </li>
        ))}
      </ul>
      {node}
    </figure>
  );
}

export function WeekdayChart({
  stats,
  target,
}: {
  stats: HabitStats;
  target: number;
}) {
  // Monday first reads naturally for a week.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <AverageBars
      title="曜日ごとの平均"
      hint="記録した日の平均摂取カロリー。縦線は目標です。"
      reference={target}
      rows={order.map((weekday) => {
        const row = stats.weekdays[weekday]!;
        return {
          label: `${weekdayLabels[weekday]}曜`,
          value: row.averageKcal,
          detail: `${row.loggedDays} 日分の平均`,
        };
      })}
    />
  );
}

export function MealTypeChart({ stats }: { stats: HabitStats }) {
  return (
    <AverageBars
      title="食事ごとの平均"
      hint="記録した日 1 日あたりの平均カロリー。"
      rows={mealTypes.map((type) => ({
        label: mealTypeLabels[type],
        value: stats.mealTypes[type],
        detail: `${stats.summary.loggedDays} 日の平均`,
      }))}
    />
  );
}
