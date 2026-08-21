import { useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const options = [
    { value: 'light' as const, icon: <Sun className="h-4 w-4" />, label: 'Light' },
    { value: 'dark' as const, icon: <Moon className="h-4 w-4" />, label: 'Dark' },
    { value: 'system' as const, icon: <Monitor className="h-4 w-4" />, label: 'System' },
  ];

  const current = options.find((o) => o.value === theme) || options[2];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        title="Toggle theme"
      >
        {current.icon}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border bg-background p-1 shadow-lg">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setTheme(opt.value); setOpen(false); }}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  theme === opt.value ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
