import { useToast } from '@/hooks/use-toast';
import { Toast } from './toast';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className='fixed top-4 right-4 z-[100] flex max-h-screen w-full max-w-[420px] flex-col gap-2 pointer-events-none'>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          id={t.id}
          title={t.title ?? ''}
          description={t.description ?? ''}
          variant={t.variant ?? 'default'}
          onDismiss={(id) => dismiss(id)}
        />
      ))}
    </div>
  );
}
