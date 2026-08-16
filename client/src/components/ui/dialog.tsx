import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

export function DialogContent({
  className,
  title,
  description,
  children,
  onClose,
}: {
  className?: string;
  title?: ReactNode;
  description?: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      {/*
        Full-viewport scroll container + flex centering: the old
        `top-1/2 -translate-y-1/2` pattern clips tall dialogs (content taller
        than the viewport can't be scrolled to). This one always scrolls.
      */}
      <DialogPrimitive.Content className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
          <div
            className={cn(
              'relative w-full max-w-lg rounded-xl border bg-background p-6 shadow-2xl animate-scale-in',
              className
            )}
          >
            {title && (
              <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            )}
            {description && <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>}
            <div className="mt-4">{children}</div>
            <DialogPrimitive.Close
              onClick={onClose}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
