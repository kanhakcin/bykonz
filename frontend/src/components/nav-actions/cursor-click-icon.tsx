import type { Variants } from 'framer-motion';
import { motion, useAnimation } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils/cn.util';

interface CursorClickIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const CURSOR_VARIANTS: Variants = {
  initial: { x: 0, y: 0 },
  hover: {
    x: [0, 0, -3, 0],
    y: [0, -4, 0, 0],
    transition: {
      duration: 1,
      bounce: 0.3,
    },
  },
};

const LINE_VARIANTS: Variants = {
  initial: { opacity: 1, x: 0, y: 0 },
  spread: (custom: { x: number; y: number }) => ({
    opacity: [0, 1, 0, 0, 0, 0, 1],
    x: [0, custom.x, 0, 0],
    y: [0, custom.y, 0, 0],
    transition: {
      type: 'spring',
      stiffness: 70,
      damping: 10,
      mass: 0.4,
    },
  }),
};

export function CursorClickIcon({ className, size = 28, ...props }: CursorClickIconProps) {
  const clickControls = useAnimation();
  const cursorControls = useAnimation();

  useEffect(() => {
    const animate = async () => {
      while (true) {
        await cursorControls.start('hover');
        await clickControls.start('spread', { delay: 1.3 });
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    };

    animate();
  }, [clickControls, cursorControls]);

  return (
    <div className={cn(className)} {...props}>
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
        <title>Cursor click</title>
        <motion.path
          animate={cursorControls}
          d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"
          variants={CURSOR_VARIANTS}
        />
        <motion.path animate={clickControls} custom={{ x: 1, y: -1 }} d="M14 4.1 12 6" variants={LINE_VARIANTS} />
        <motion.path animate={clickControls} custom={{ x: -1, y: 0 }} d="m5.1 8-2.9-.8" variants={LINE_VARIANTS} />
        <motion.path animate={clickControls} custom={{ x: -1, y: 1 }} d="m6 12-1.9 2" variants={LINE_VARIANTS} />
        <motion.path animate={clickControls} custom={{ x: 0, y: -1 }} d="M7.2 2.2 8 5.1" variants={LINE_VARIANTS} />
      </svg>
    </div>
  );
}
