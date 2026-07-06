import { Slot } from 'radix-ui';
import type { HTMLAttributes, ReactNode } from 'react';
import { createContext, useCallback, useContext, useState } from 'react';
import { cn } from '@/lib/utils/cn.util';

// Context
const TimelineContext = createContext<TimelineContextValue | undefined>(undefined);

const useTimeline = () => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error('useTimeline must be used within a Timeline');
  }
  return context;
};

function Timeline({ defaultValue = 1, value, onValueChange, orientation = 'vertical', className, children, ...props }: TimelineProps) {
  const [activeStep, setInternalStep] = useState(defaultValue);

  const setActiveStep = useCallback(
    (step: number) => {
      if (value === undefined) {
        setInternalStep(step);
      }
      onValueChange?.(step);
    },
    [value, onValueChange],
  );

  const currentStep = value ?? activeStep;

  return (
    <TimelineContext.Provider value={{ activeStep: currentStep, setActiveStep }}>
      <div
        className={cn('group/timeline flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col', className)}
        data-orientation={orientation}
        data-slot="timeline"
        {...props}
      >
        {children}
      </div>
    </TimelineContext.Provider>
  );
}

// TimelineContent
function TimelineContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-muted-foreground text-sm', className)} data-slot="timeline-content" {...props} />;
}

function TimelineDate({ asChild = false, className, ...props }: TimelineDateProps) {
  const Comp = asChild ? Slot.Root : 'time';

  return (
    <Comp
      className={cn('mb-1 block font-medium text-muted-foreground text-xs group-data-[orientation=vertical]/timeline:max-sm:h-4', className)}
      data-slot="timeline-date"
      {...props}
    />
  );
}

// TimelineHeader
function TimelineHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} data-slot="timeline-header" {...props} />;
}

function TimelineIndicator({ asChild = false, icon, className, children, ...props }: TimelineIndicatorProps) {
  const Comp = asChild ? Slot.Root : 'div';

  return (
    <Comp
      aria-hidden="true"
      className={cn(
        'absolute size-4 rounded-full border-2 border-primary/20 group-data-[orientation=horizontal]/timeline:-top-6 group-data-[orientation=vertical]/timeline:top-0 group-data-[orientation=horizontal]/timeline:left-0 group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:-translate-x-1/2 group-data-[orientation=horizontal]/timeline:-translate-y-1/2 group-data-completed/timeline-item:border-primary',
        icon &&
          'flex size-6 items-center justify-center border-none bg-primary/10 text-primary group-data-[orientation=vertical]/timeline:-left-7 group-data-completed/timeline-item:bg-primary group-data-completed/timeline-item:text-primary-foreground',
        className,
      )}
      data-slot="timeline-indicator"
      {...props}
    >
      {icon || children}
    </Comp>
  );
}

function TimelineItem({ step, className, ...props }: TimelineItemProps) {
  const { activeStep } = useTimeline();

  return (
    <div
      className={cn(
        'group/timeline-item relative flex flex-1 flex-col gap-0.5 group-data-[orientation=vertical]/timeline:ms-8 group-data-[orientation=horizontal]/timeline:mt-8 group-data-[orientation=horizontal]/timeline:not-last:pe-8 group-data-[orientation=vertical]/timeline:not-last:pb-6',
        className,
      )}
      data-completed={step <= activeStep || undefined}
      data-slot="timeline-item"
      {...props}
    />
  );
}

// TimelineSeparator
function TimelineSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute self-start bg-primary/10 group-last/timeline-item:hidden group-has-[+[data-completed]]/timeline-item:bg-primary group-data-[orientation=horizontal]/timeline:-top-6 group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=horizontal]/timeline:h-0.5 group-data-[orientation=vertical]/timeline:h-[calc(100%-1rem-0.25rem)] group-data-[orientation=horizontal]/timeline:w-[calc(100%-1rem-0.25rem)] group-data-[orientation=vertical]/timeline:w-0.5 group-data-[orientation=horizontal]/timeline:translate-x-4.5 group-data-[orientation=vertical]/timeline:-translate-x-1/2 group-data-[orientation=horizontal]/timeline:-translate-y-1/2 group-data-[orientation=vertical]/timeline:translate-y-4.5',
        className,
      )}
      data-slot="timeline-separator"
      {...props}
    />
  );
}

// TimelineTitle
function TimelineTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-medium text-sm', className)} data-slot="timeline-title" {...props} />;
}

export { Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle };

type TimelineContextValue = {
  activeStep: number;
  setActiveStep: (step: number) => void;
};

interface TimelineProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  orientation?: 'horizontal' | 'vertical';
}

interface TimelineDateProps extends HTMLAttributes<HTMLTimeElement> {
  asChild?: boolean;
}

interface TimelineIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  icon?: ReactNode;
}

interface TimelineItemProps extends HTMLAttributes<HTMLDivElement> {
  step: number;
}
