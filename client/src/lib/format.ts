/** Formatting helpers (INR, dates, relative time). */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const inrShort = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export function formatINR(value: number | null | undefined): string {
  return inr.format(value || 0);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return 'never';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

/** How far a due date is: overdue / today / soon / later. */
export function dueLabel(value: string | Date | null | undefined): { label: string; tone: 'danger' | 'warning' | 'info' | 'muted' } {
  if (!value) return { label: 'no date', tone: 'muted' };
  const due = new Date(value);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (due < now) {
    const mins = Math.floor((now.getTime() - due.getTime()) / 60000);
    if (mins < 60) return { label: `${mins}m overdue`, tone: 'danger' };
    if (mins < 1440) return { label: `${Math.floor(mins / 60)}h overdue`, tone: 'danger' };
    return { label: `${Math.floor(mins / 1440)}d overdue`, tone: 'danger' };
  }
  const endToday = startToday.getTime() + 86400000;
  if (due.getTime() < endToday) return { label: 'today', tone: 'warning' };
  const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (days <= 3) return { label: `in ${days}d`, tone: 'warning' };
  return { label: formatDate(due), tone: 'info' };
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
