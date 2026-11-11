export const number = (value: number | null | undefined, suffix = '') =>
  value == null || !Number.isFinite(value) ? '—' : `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value)}${suffix}`;

export function bytes(value?: number) {
  if (value == null) return '—';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const scale = Math.min(4, Math.max(0, Math.floor(Math.log(Math.max(1, value)) / Math.log(1024))));
  return `${number(value / 1024 ** scale)} ${units[scale]}`;
}
