import * as Dropdown from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function DropdownMenu({ trigger, children, align = 'end' }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'center' | 'end' }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align={align}
          className="z-50 min-w-[12rem] rounded-lg border bg-popover bg-background p-1.5 shadow-lg animate-scale-in"
        >
          {children}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export function DropdownItem({
  children,
  onSelect,
  danger,
  icon,
}: {
  children: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Dropdown.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none',
        'focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent',
        danger && 'text-destructive focus:text-destructive'
      )}
    >
      {icon}
      {children}
    </Dropdown.Item>
  );
}

export function DropdownSeparator() {
  return <Dropdown.Separator className="my-1.5 h-px bg-border" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>;
}
