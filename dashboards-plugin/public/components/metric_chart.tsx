import React from 'react';
import { EuiPanel, EuiTitle } from '@elastic/eui';
import type { SeriesPoint } from '../../common/types';
import { number } from '../format';

interface Props {
  title: string;
  points: SeriesPoint[];
  lines: Array<{ field: keyof Omit<SeriesPoint, 'timestamp'>; label: string; color: string }>;
  unit?: string;
  percent?: boolean;
}

/** Native SVG keeps charts small and avoids another chart library/version dependency. */
export function MetricChart({ title, points, lines, unit = '', percent = false }: Props) {
  const width = 640, height = 180, left = 55, right = 14, top = 14, bottom = 28;
  const values = points.flatMap(point => lines.map(line => point[line.field]).filter((value): value is number => value != null));
  const max = percent ? 100 : Math.max(1, ...values) * 1.15;
  const start = points[0]?.timestamp ?? 0;
  const end = points[points.length - 1]?.timestamp ?? start + 1;
  const x = (timestamp: number) => left + (timestamp - start) / Math.max(1, end - start) * (width - left - right);
  const y = (value: number) => height - bottom - value / max * (height - top - bottom);
  return <EuiPanel paddingSize="m" className="smChart">
    <EuiTitle size="xs"><h3>{title}</h3></EuiTitle>
    <div className="smLegend">{lines.map(line => <span key={line.field}><i style={{ background: line.color }} />{line.label}</span>)}</div>
    {values.length === 0 ? <p className="smEmptyChart">Noch keine Messwerte in diesem Zeitraum.</p> :
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}. ${points.length} Zeitpunkte. Einheit ${unit}`}>
        {[0, 0.5, 1].map(fraction => <g key={fraction}>
          <line x1={left} x2={width - right} y1={y(max * fraction)} y2={y(max * fraction)} className="smGrid" />
          <text x={left - 8} y={y(max * fraction) + 4} textAnchor="end">{number(max * fraction)}{unit}</text>
        </g>)}
        {lines.map(line => {
          // Break paths at missing buckets: an outage must not look like continuous monitoring.
          let path = '', penDown = false;
          for (const point of points) {
            const value = point[line.field];
            if (value == null) { penDown = false; continue; }
            path += `${penDown ? 'L' : 'M'}${x(point.timestamp)},${y(value)} `;
            penDown = true;
          }
          return <path key={line.field} d={path} stroke={line.color} fill="none" strokeWidth="2" />;
        })}
        {[start, end].map((time, index) => <text key={index} x={x(time)} y={height - 6} textAnchor={index ? 'end' : 'start'}>{new Date(time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</text>)}
      </svg>}
  </EuiPanel>;
}
