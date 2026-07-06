import { motion, type Transition, useAnimation } from 'framer-motion';
import type { MouseEvent } from 'react';
import { forwardRef, type HTMLAttributes, useCallback, useImperativeHandle, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { SIDEBAR_KEYBOARD_SHORTCUT } from '@/components/ui/sidebar';
import { useModifierKeyLabel } from '@/hooks/use-modifier-key-label';
import { useSidebar } from '@/hooks/use-sidebar-toggle';
import { cn } from '@/lib/utils/cn.util';

export function SidebarSwitcher() {
  const { open, isHovered, toggle } = useSidebar();
  const modifier = useModifierKeyLabel();

  const renderContent = () => {
    if (open) return <MaximizeIcon className="flex h-full w-full items-center justify-center" />;
    if (isHovered) return <MinimizeIcon className="flex h-full w-full items-center justify-center" />;
    return <Kbd>{`${modifier}${SIDEBAR_KEYBOARD_SHORTCUT.toUpperCase()}`}</Kbd>;
  };

  return (
    <Button size="icon" variant="ghost" onClick={toggle} aria-label="Toggle Sidebar">
      {renderContent()}
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

// --- Icons ---

const DEFAULT_TRANSITION: Transition = {
  type: 'spring',
  stiffness: 250,
  damping: 25,
};

const MaximizeIcon = forwardRef<MaximizeIconHandle, HTMLAttributes<HTMLDivElement>>(({ onMouseEnter, onMouseLeave, className, ...props }, ref) => {
  const controls = useAnimation();
  const isControlledRef = useRef(false);

  useImperativeHandle(ref, () => {
    isControlledRef.current = true;
    return {
      startAnimation: () => controls.start('animate'),
      stopAnimation: () => controls.start('normal'),
    };
  });

  const handleMouseEnter = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseEnter?.(e);
      } else {
        controls.start('animate');
      }
    },
    [controls, onMouseEnter],
  );

  const handleMouseLeave = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseLeave?.(e);
      } else {
        controls.start('normal');
      }
    },
    [controls, onMouseLeave],
  );

  return (
    <div role="presentation" className={cn(className)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
      <svg fill="none" height="28" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="28" xmlns="http://www.w3.org/2000/svg">
        <title>MaximizeIcon</title>
        <motion.path
          animate={controls}
          d="M8 3H5a2 2 0 0 0-2 2v3"
          transition={DEFAULT_TRANSITION}
          variants={{
            normal: { translateX: '0%', translateY: '0%' },
            animate: { translateX: '-2px', translateY: '-2px' },
          }}
        />
        <motion.path
          animate={controls}
          d="M21 8V5a2 2 0 0 0-2-2h-3"
          transition={DEFAULT_TRANSITION}
          variants={{
            normal: { translateX: '0%', translateY: '0%' },
            animate: { translateX: '2px', translateY: '-2px' },
          }}
        />
        <motion.path
          animate={controls}
          d="M3 16v3a2 2 0 0 0 2 2h3"
          transition={DEFAULT_TRANSITION}
          variants={{
            normal: { translateX: '0%', translateY: '0%' },
            animate: { translateX: '-2px', translateY: '2px' },
          }}
        />
        <motion.path
          animate={controls}
          d="M16 21h3a2 2 0 0 0 2-2v-3"
          transition={DEFAULT_TRANSITION}
          variants={{
            normal: { translateX: '0%', translateY: '0%' },
            animate: { translateX: '2px', translateY: '2px' },
          }}
        />
      </svg>
    </div>
  );
});

MaximizeIcon.displayName = 'MaximizeIcon';

const MinimizeIcon = forwardRef<MinimizeIconHandle, HTMLAttributes<HTMLDivElement>>(({ onMouseEnter, onMouseLeave, className, ...props }, ref) => {
  const controls = useAnimation();
  const isControlledRef = useRef(false);

  useImperativeHandle(ref, () => {
    isControlledRef.current = true;

    return {
      startAnimation: () => controls.start('animate'),
      stopAnimation: () => controls.start('normal'),
    };
  });

  const handleMouseEnter = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseEnter?.(e);
      } else {
        controls.start('animate');
      }
    },
    [controls, onMouseEnter],
  );

  const handleMouseLeave = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseLeave?.(e);
      } else {
        controls.start('normal');
      }
    },
    [controls, onMouseLeave],
  );

  return (
    <div role="presentation" className={cn(className)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
      <svg
        fill="none"
        height="28"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="28"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>MinimizeIcon</title>
        <motion.path
          animate={controls}
          d="M8 3v3a2 2 0 0 1-2 2H3"
          transition={DEFAULT_TRANSITION}
          variants={{
            normal: { translateX: '0%', translateY: '0%' },
            animate: { translateX: '2px', translateY: '2px' },
          }}
        />
        <motion.path
          animate={controls}
          d="M21 8h-3a2 2 0 0 1-2-2V3"
          transition={DEFAULT_TRANSITION}
          variants={{
            normal: { translateX: '0%', translateY: '0%' },
            animate: { translateX: '-2px', translateY: '2px' },
          }}
        />
        <motion.path
          animate={controls}
          d="M3 16h3a2 2 0 0 1 2 2v3"
          transition={DEFAULT_TRANSITION}
          variants={{
            normal: { translateX: '0%', translateY: '0%' },
            animate: { translateX: '2px', translateY: '-2px' },
          }}
        />
        <motion.path
          animate={controls}
          d="M16 21v-3a2 2 0 0 1 2-2h3"
          transition={DEFAULT_TRANSITION}
          variants={{
            normal: { translateX: '0%', translateY: '0%' },
            animate: { translateX: '-2px', translateY: '-2px' },
          }}
        />
      </svg>
    </div>
  );
});

MinimizeIcon.displayName = 'MinimizeIcon';

export interface MaximizeIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export interface MinimizeIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}
