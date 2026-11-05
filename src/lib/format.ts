export function money(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

export function list(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function budgetLabel(target: number | null, ceiling: number | null): string {
  if (target && ceiling && target !== ceiling) {
    return `${money(target)}–${money(ceiling)}`;
  }
  if (ceiling && !target) return `under ${money(ceiling)}`;
  if (target) return money(target);
  if (ceiling) return money(ceiling);
  return 'No budget yet';
}

export function chicagoToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDay(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function dueMeta(iso: string, today: string): { label: string; tone: 'overdue' | 'soon' | 'ok' | 'none' } {
  if (!iso) return { label: '', tone: 'none' };
  const [y1, m1, d1] = iso.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  const due = Date.UTC(y1, m1 - 1, d1);
  const now = Date.UTC(y2, m2 - 1, d2);
  const days = Math.round((due - now) / 86_400_000);
  if (days < 0) {
    const n = Math.abs(days);
    return { label: n === 1 ? '1 day overdue' : `${n} days overdue`, tone: 'overdue' };
  }
  if (days === 0) return { label: 'Due today', tone: 'soon' };
  if (days === 1) return { label: 'Due tomorrow', tone: 'soon' };
  if (days <= 3) return { label: `Due in ${days} days`, tone: 'soon' };
  return { label: formatDay(iso), tone: 'ok' };
}
