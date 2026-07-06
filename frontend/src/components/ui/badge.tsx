import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn.util';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm px-2 py-1 font-medium text-xs ring-1 ring-inset [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-blue-50 text-blue-900 ring-blue-500/30 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30',
        secondary: 'bg-gray-50 text-gray-900 ring-gray-500/30 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20',
        outline: 'bg-transparent text-foreground ring-border dark:ring-border',
        // Semantic status variants
        success: 'bg-emerald-50 text-emerald-900 ring-emerald-600/30 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20',
        online: 'bg-emerald-50 text-emerald-900 ring-emerald-600/30 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20',
        active: 'bg-emerald-50 text-emerald-900 ring-emerald-600/30 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20',
        warning: 'bg-yellow-50 text-yellow-900 ring-yellow-600/30 dark:bg-yellow-400/10 dark:text-yellow-500 dark:ring-yellow-400/20',
        pending: 'bg-yellow-50 text-yellow-900 ring-yellow-600/30 dark:bg-yellow-400/10 dark:text-yellow-500 dark:ring-yellow-400/20',
        error: 'bg-red-50 text-red-900 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20',
        canceled: 'bg-red-50 text-red-900 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20',
        offline: 'bg-red-50 text-red-900 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20',
        info: 'bg-blue-50 text-blue-900 ring-blue-500/30 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30',
        neutral: 'bg-gray-50 text-gray-900 ring-gray-500/30 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20',
        orange: 'bg-orange-50 text-orange-900 ring-orange-500/30 dark:bg-orange-400/10 dark:text-orange-400 dark:ring-orange-400/20',
        cyan: 'bg-cyan-50 text-cyan-900 ring-cyan-500/30 dark:bg-cyan-400/10 dark:text-cyan-400 dark:ring-cyan-400/20',
        violet: 'bg-violet-50 text-violet-900 ring-violet-500/30 dark:bg-violet-400/10 dark:text-violet-400 dark:ring-violet-400/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({ className, variant, asChild = false, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const Status = ({ className, status, ...props }: StatusProps) => <Badge className={cn('group flex items-center gap-2', status, className)} variant={status} {...props} />;

const StatusIndicator = ({ className, status, ...props }: StatusIndicatorProps) => {
  const statusIndicatorColors: Record<StatusVariant, string> = {
    success: 'bg-emerald-500',
    active: 'bg-emerald-500',
    warning: 'bg-yellow-500',
    pending: 'bg-yellow-500',
    error: 'bg-red-500',
    canceled: 'bg-red-500',
    info: 'bg-blue-500',
    neutral: 'bg-gray-500',
    cyan: 'bg-cyan-500',
    violet: 'bg-violet-500',
  };
  const colorClass = status ? statusIndicatorColors[status] : '';

  return (
    <span className="relative flex size-2" {...props}>
      <span
        className={cn(
          'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
          colorClass,
          'group-[.active]:bg-emerald-500 group-[.success]:bg-emerald-500',
          'group-[.pending]:bg-yellow-500 group-[.warning]:bg-yellow-500',
          'group-[.canceled]:bg-red-500 group-[.error]:bg-red-500',
          'group-[.info]:bg-blue-500 group-[.neutral]:bg-gray-500',
          'group-[.cyan]:bg-cyan-500 group-[.violet]:bg-violet-500',
        )}
      />
      <span
        className={cn(
          'relative inline-flex size-2 rounded-full',
          colorClass,
          'group-[.active]:bg-emerald-500 group-[.success]:bg-emerald-500',
          'group-[.pending]:bg-yellow-500 group-[.warning]:bg-yellow-500',
          'group-[.canceled]:bg-red-500 group-[.error]:bg-red-500',
          'group-[.info]:bg-blue-500 group-[.neutral]:bg-gray-500',
          'group-[.cyan]:bg-cyan-500 group-[.violet]:bg-violet-500',
        )}
      />
    </span>
  );
};

const StatusLabel = ({ className, children, ...props }: StatusLabelProps) => (
  <span className={cn('text-current', className)} {...props}>
    {children}
  </span>
);

export { Badge, badgeVariants, Status, StatusIndicator, StatusLabel };

// Status Components - combines Badge with animated indicator
export type StatusVariant = 'success' | 'active' | 'warning' | 'pending' | 'error' | 'canceled' | 'info' | 'neutral' | 'cyan' | 'violet';

export type StatusIndicatorProps = HTMLAttributes<HTMLSpanElement> & {
  status?: StatusVariant;
};

export type StatusProps = ComponentProps<typeof Badge> & {
  status: StatusVariant;
};

export type StatusLabelProps = HTMLAttributes<HTMLSpanElement>;
