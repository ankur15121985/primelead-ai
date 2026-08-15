import { Badge } from '@/components/ui/badge';
import { STATUS_META, PRIORITY_META } from '@/lib/constants';

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, className: 'bg-muted text-muted-foreground border-transparent' };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}>{meta.label}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority] || { label: priority, className: 'bg-muted text-muted-foreground border-transparent' };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}>{meta.label}</span>;
}
