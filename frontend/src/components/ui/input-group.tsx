import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/cn.util';

const inputGroupVariants = cva('flex w-fit items-stretch [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 [&>input]:flex-1', {
  variants: {
    orientation: {
      horizontal: '[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none',
      vertical: 'flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none',
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
  },
});

function InputGroup({ className, orientation, ...props }: ComponentProps<'div'> & VariantProps<typeof inputGroupVariants>) {
  return <div data-slot="input-group" data-orientation={orientation} className={cn(inputGroupVariants({ orientation }), className)} {...props} />;
}

function InputGroupText({
  className,
  asChild = false,
  ...props
}: ComponentProps<'div'> & {
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      className={cn("flex items-center gap-2 rounded-md border bg-muted px-4 font-medium text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none", className)}
      {...props}
    />
  );
}

function InputGroupSeparator({ className, orientation = 'vertical', ...props }: ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="input-group-separator"
      orientation={orientation}
      className={cn('relative m-0! self-stretch bg-input data-[orientation=vertical]:h-auto', className)}
      {...props}
    />
  );
}

export { InputGroup, InputGroupSeparator, InputGroupText, inputGroupVariants };
