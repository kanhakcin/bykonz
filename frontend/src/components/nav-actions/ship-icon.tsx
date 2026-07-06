import type { Variants } from 'framer-motion';
import { motion } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn.util';

const PATH_VARIANTS: Variants = {
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      delay: 0.15,
      opacity: { delay: 0.1 },
      repeat: Number.POSITIVE_INFINITY,
      repeatDelay: 2,
      duration: 1,
    },
  },
};

const G_VARIANTS: Variants = {
  animate: {
    rotate: [-3, 3, -5],
    transition: {
      repeat: Number.POSITIVE_INFINITY,
      repeatType: 'mirror' as const,
      duration: 1.2,
      ease: 'easeInOut',
    },
  },
};

const ShipIcon = forwardRef<HTMLDivElement, ShipIconProps>(({ className, size = 28, ...props }, ref) => {
  return (
    <div ref={ref} className={cn('flex items-center justify-center', className)} {...props}>
      <svg
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Ship</title>
        <motion.path
          animate="animate"
          initial={{ pathLength: 0, opacity: 0 }}
          d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"
          variants={PATH_VARIANTS}
        />
        <motion.g animate="animate" initial={{ rotate: 0 }} variants={G_VARIANTS}>
          <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
          <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
          <path d="M12 10v4" />
          <path d="M12 2v3" />
        </motion.g>
      </svg>
    </div>
  );
});

ShipIcon.displayName = 'ShipIcon';

export { ShipIcon };

interface ShipIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}
