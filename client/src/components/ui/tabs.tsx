import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabDef {
  value: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  content: ReactNode;
}

/** Simple controlled tabs — each tab carries its own content. */
export function Tabs({
  tabs,
  value,
  onValueChange,
  className,
}: {
  tabs: TabDef[];
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
}) {
  const active = tabs.find((t) => t.value === value) || tabs[0];
  return (
    <div className={className}>
      <div className="inline-flex h-10 items-center gap-1 rounded-lg bg-muted p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={t.value === active?.value}
            onClick={() => onValueChange(t.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              'text-muted-foreground hover:text-foreground',
              t.value === active?.value && 'bg-background text-foreground shadow-sm'
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">{t.count}</span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-4">{active?.content}</div>
    </div>
  );
}
