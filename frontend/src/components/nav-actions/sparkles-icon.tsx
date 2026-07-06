import type { Variants } from 'framer-motion';
import { motion } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn.util';

const SPARKLE_VARIANTS: Variants = {
  animate: {
    y: [0, -1, 0, 0],
    fill: ['none', 'currentColor', 'currentColor', 'none'],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    } as any,
  },
};

const STAR_VARIANTS: Variants = {
  animate: {
    opacity: [0, 1, 0, 0, 0, 1, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'linear',
    } as any,
  },
};

const SparklesIcon = forwardRef<HTMLDivElement, SparklesIconProps>(({ className, size = 28, ...props }, ref) => {
  return (
    <div ref={ref} className={cn('flex items-center justify-center', className)} {...props}>
      <svg
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Sparkles</title>
        <motion.path
          animate="animate"
          d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
          variants={SPARKLE_VARIANTS}
        />
        <motion.path animate="animate" d="M20 3v4" variants={STAR_VARIANTS} initial={{ opacity: 0 }} />
        <motion.path animate="animate" d="M22 5h-4" variants={STAR_VARIANTS} initial={{ opacity: 0 }} />
        <motion.path animate="animate" d="M4 17v2" variants={STAR_VARIANTS} initial={{ opacity: 0 }} transition={{ delay: 1.5, repeat: Infinity, duration: 3 }} />
        <motion.path animate="animate" d="M5 18H3" variants={STAR_VARIANTS} initial={{ opacity: 0 }} transition={{ delay: 1.5, repeat: Infinity, duration: 3 }} />
      </svg>
    </div>
  );
});

SparklesIcon.displayName = 'SparklesIcon';

export { SparklesIcon };

interface SparklesIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}
