import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing } from 'lucide-react';
import { useNotifications, useMarkNotificationsRead } from '@/hooks/queries';
import { timeAgo } from '@/lib/format';
import { DropdownMenu, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/dropdown-menu';

export function NotificationsBell() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);
  const unread = data?.unread || 0;

  const handleOpen = () => {
    setOpen(true);
    if (unread > 0) markRead.mutate();
  };

  return (
    <DropdownMenu
      trigger={
        <button
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          {unread > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      }
      align="end"
    >
      <DropdownLabel>Notifications</DropdownLabel>
      <DropdownSeparator />
      {!data?.items.length && <div className="px-3 py-6 text-center text-sm text-muted-foreground">You're all caught up 🎉</div>}
      <div className="max-h-80 overflow-y-auto">
        {data?.items.slice(0, 12).map((n) => (
          <DropdownItem key={n.id} onSelect={() => undefined}>
            <Link to={n.link || '/app/dashboard'} className="block w-full" onClick={() => setOpen(false)}>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{n.title}</span>
                {n.body && <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                <span className="text-[10px] text-muted-foreground/70">{timeAgo(n.createdAt)}</span>
              </div>
            </Link>
          </DropdownItem>
        ))}
      </div>
      <DropdownSeparator />
      <DropdownItem onSelect={() => setOpen(false)}>
        <Link to="/app/dashboard" className="w-full text-center text-xs">View dashboard</Link>
      </DropdownItem>
    </DropdownMenu>
  );
}
