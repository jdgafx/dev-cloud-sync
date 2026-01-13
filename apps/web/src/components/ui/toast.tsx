import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
  onDismiss: (id: string) => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ id, title, description, variant = 'default', onDismiss }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-2xl border p-4 pr-8 shadow-2xl transition-all animate-in slide-in-from-top-full',
          variant === 'default' &&
            'border-slate-800 bg-slate-900/95 text-slate-100 backdrop-blur-xl',
          variant === 'destructive' &&
            'border-red-500/30 bg-red-950/95 text-red-100 backdrop-blur-xl',
          variant === 'success' &&
            'border-emerald-500/30 bg-emerald-950/95 text-emerald-100 backdrop-blur-xl'
        )}
      >
        <div className='grid gap-1'>
          {title && <div className='text-sm font-bold'>{title}</div>}
          {description && (
            <div className='text-xs opacity-80'>{description}</div>
          )}
        </div>
        <button
          onClick={() => onDismiss(id)}
          className='absolute right-2 top-2 rounded-lg p-1 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100'
        >
          <X className='h-4 w-4' />
        </button>
      </div>
    );
  }
);
Toast.displayName = 'Toast';

export { Toast, type ToastProps };
