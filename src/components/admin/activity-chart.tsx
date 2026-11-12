import type { Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";

type Point = { day: string; views: number; signups: number; active_users: number };

/**
 * График активности за период: область — просмотры, столбцы — регистрации.
 * Серверный SVG без клиентского кода; значения доступны через <title> и таблицу для скринридеров.
 */
export function ActivityChart({ data, locale, labels }: { data: Point[]; locale: Locale; labels: { views: string; signups: string; active: string } }) {
  if (data.length === 0) return null;
  const width = 800;
  const height = 240;
  const pad = { top: 16, right: 12, bottom: 28, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxViews = Math.max(4, ...data.map((point) => point.views));
  const maxSignups = Math.max(4, ...data.map((point) => point.signups));
  const step = innerW / Math.max(1, data.length - 1);
  const x = (index: number) => pad.left + index * step;
  const y = (value: number) => pad.top + innerH - (value / maxViews) * innerH;
  const line = data.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.views).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${pad.top + innerH} L${pad.left},${pad.top + innerH} Z`;
  const barW = Math.max(3, Math.min(14, step * 0.45));
  const ticks = [0, 0.5, 1].map((ratio) => Math.round(maxViews * ratio));

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`${labels.views} / ${labels.signups}`}>
        <defs>
          <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.45" />
            <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="rgb(255 255 255 / 0.08)" />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#807b9f">
              {formatNumber(locale, tick)}
            </text>
          </g>
        ))}
        {data.map((point, index) => {
          const barH = (point.signups / maxSignups) * innerH * 0.45;
          return (
            <rect key={`bar-${point.day}`} x={x(index) - barW / 2} y={pad.top + innerH - barH} width={barW} height={barH} rx="2" fill="#38bdf8" opacity="0.55">
              <title>{`${formatDate(locale, point.day, { day: "numeric", month: "short" })} · ${labels.signups}: ${point.signups}`}</title>
            </rect>
          );
        })}
        <path d={area} fill="url(#chart-area)" />
        <path d={line} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((point, index) => (
          <circle key={`dot-${point.day}`} cx={x(index)} cy={y(point.views)} r="7" fill="transparent">
            <title>{`${formatDate(locale, point.day, { day: "numeric", month: "short" })} · ${labels.views}: ${point.views} · ${labels.active}: ${point.active_users}`}</title>
          </circle>
        ))}
        {data.map((point, index) =>
          index % Math.ceil(data.length / 6) === 0 ? (
            <text key={`label-${point.day}`} x={x(index)} y={height - 8} textAnchor="middle" fontSize="11" fill="#807b9f">
              {formatDate(locale, point.day, { day: "numeric", month: "short" })}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-violet-400" aria-hidden />
          {labels.views}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-sky-400/60" aria-hidden />
          {labels.signups}
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>{labels.views}</caption>
        <tbody>
          {data.map((point) => (
            <tr key={point.day}>
              <th scope="row">{point.day}</th>
              <td>{point.views}</td>
              <td>{point.signups}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
