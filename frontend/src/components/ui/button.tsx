import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn.util';

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium font-mono text-sm leading-none outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:-translate-y-px",
  {
    variants: {
      variant: {
        primary:
          'relative inset-shadow-2xs inset-shadow-white flex border border-zinc-300 bg-secondary ring-0 duration-150 hover:bg-background dark:inset-shadow-transparent dark:border-border dark:bg-muted/25 dark:hover:bg-muted/50',
        default: 'relative border-input/50 border-b-2 bg-background ring-1 ring-zinc-300 hover:bg-secondary dark:border-input dark:ring-input',
        basic: 'border-input/50 bg-background ring-1 ring-zinc-300 hover:bg-secondary dark:border-input dark:ring-input',
        outline: 'relative inset-shadow-2xs inset-shadow-background border border-input bg-secondary text-secondary-foreground shadow-zinc-950/10 duration-150 hover:bg-muted',
        ghost: 'transition-colors hover:bg-foreground/10',
        link: 'text-primary underline-offset-4 hover:underline hover:decoration-dashed hover:underline-offset-4',
        blue: 'border-none bg-linear-to-r from-blue-600 to-blue-500 text-white transition-all duration-200 hover:scale-[1.02] hover:from-blue-500 hover:to-blue-600 hover:text-white active:scale-[0.98]',
        green:
          'border-none bg-linear-to-r from-green-600 to-green-500 text-white transition-all duration-200 hover:scale-[1.02] hover:from-green-500 hover:to-green-600 hover:text-white active:scale-[0.98]',
        destructive:
          'relative inset-shadow-2xs inset-shadow-background border border-destructive bg-destructive text-white shadow-zinc-950/10 duration-150 hover:bg-destructive/90 dark:bg-destructive/80',
      },
      size: {
        default: 'h-11 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-12 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return <Comp data-slot="button" data-variant={variant} data-size={size} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
