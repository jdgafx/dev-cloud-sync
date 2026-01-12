import { cn } from '../lib/utils';

export const Branding = ({ className }: { className?: string }) => {
  return (
    <div className={cn(
      'flex items-center justify-center gap-2 py-4 px-3 border-t border-zinc-800/50',
      className
    )}>
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-semibold text-zinc-500 tracking-wide">
          CGDarkstardev1
        </span>
        <span className="text-[9px] text-zinc-600">
          New Dawn AI © 2026
        </span>
      </div>
    </div>
  );
};
