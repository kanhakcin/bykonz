import type { Transition, Variants } from 'framer-motion';
import { motion, useAnimation } from 'framer-motion';
import { Cog } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { MouseEvent } from 'react';
import { forwardRef, type HTMLAttributes, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSidebarToggle } from '@/hooks/use-sidebar-toggle';
import { cn } from '@/lib/utils/cn.util';

// --- Switcher ---

export function ThemeSwitcher() {
  const { setMenuOpen } = useSidebarToggle();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button size="icon" variant="ghost">
        <SunIcon className="flex h-full w-full items-center justify-center" />
      </Button>
    );
  }

  return (
    <DropdownMenu onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost">
          {theme === 'sunset' ? (
            <SunDimIcon className="flex h-full w-full items-center justify-center" />
          ) : theme === 'ocean-blue' ? (
            <CloudSunIcon className="flex h-full w-full items-center justify-center" />
          ) : resolvedTheme === 'dark' ? (
            <MoonIcon className="flex h-full w-full items-center justify-center" />
          ) : (
            <SunIcon className="flex h-full w-full items-center justify-center" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('system')} className={theme === 'system' ? 'bg-accent font-medium' : ''}>
          <Cog />
          System {theme === 'system' && '✓'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('light')} className={theme === 'light' ? 'bg-accent font-medium' : ''}>
          <SunIcon />
          Light {theme === 'light' && '✓'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('sunset')} className={theme === 'sunset' ? 'bg-accent font-medium' : ''}>
          <SunDimIcon />
          Sunset {theme === 'sunset' && '✓'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} className={theme === 'dark' ? 'bg-accent font-medium' : ''}>
          <MoonIcon />
          Dark {theme === 'dark' && '✓'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('ocean-blue')} className={theme === 'ocean-blue' ? 'bg-accent font-medium' : ''}>
          <CloudSunIcon />
          Ocean Blue {theme === 'ocean-blue' && '✓'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Icons ---

const SUN_PATH_VARIANTS: Variants = {
  normal: { opacity: 1 },
  animate: (i: number) => ({
    opacity: [0, 1],
    transition: { delay: i * 0.1, duration: 0.3 },
  }),
};

const SunIcon = forwardRef<SunIconHandle, HTMLAttributes<HTMLDivElement>>(({ onMouseEnter, onMouseLeave, className, ...props }, ref) => {
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
    <div className={cn(className)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
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
        <title>Sun</title>
        <circle cx="12" cy="12" r="4" />
        {['M12 2v2', 'm19.07 4.93-1.41 1.41', 'M20 12h2', 'm17.66 17.66 1.41 1.41', 'M12 20v2', 'm6.34 17.66-1.41 1.41', 'M2 12h2', 'm4.93 4.93 1.41 1.41'].map((d, index) => (
          <motion.path animate={controls} custom={index + 1} d={d} key={d} variants={SUN_PATH_VARIANTS} />
        ))}
      </svg>
    </div>
  );
});

SunIcon.displayName = 'SunIcon';

const SUN_DIM_PATH_VARIANTS: Variants = {
  normal: { opacity: 1 },
  animate: (i: number) => ({
    opacity: [0, 1],
    transition: { delay: i * 0.1, duration: 0.3 },
  }),
};

const SunDimIcon = forwardRef<SunDimIconHandle, HTMLAttributes<HTMLDivElement>>(({ onMouseEnter, onMouseLeave, className, ...props }, ref) => {
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
    <div className={cn(className)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
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
        <title>Sun Dim</title>
        <circle cx="12" cy="12" r="4" />
        {['M12 4h.01', 'M20 12h.01', 'M12 20h.01', 'M4 12h.01', 'M17.657 6.343h.01', 'M17.657 17.657h.01', 'M6.343 17.657h.01', 'M6.343 6.343h.01'].map((d, index) => (
          <motion.path animate={controls} custom={index + 1} d={d} key={d} variants={SUN_DIM_PATH_VARIANTS} />
        ))}
      </svg>
    </div>
  );
});

SunDimIcon.displayName = 'SunDimIcon';

const MOON_SVG_VARIANTS: Variants = {
  normal: {
    rotate: 0,
  },
  animate: {
    rotate: [0, -10, 10, -5, 5, 0],
  },
};

const MOON_SVG_TRANSITION: Transition = {
  duration: 1.2,
  ease: 'easeInOut',
};

const MoonIcon = forwardRef<MoonIconHandle, HTMLAttributes<HTMLDivElement>>(({ onMouseEnter, onMouseLeave, className, ...props }, ref) => {
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
    <div className={cn(className)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
      <motion.svg
        animate={controls}
        fill="none"
        height="28"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        transition={MOON_SVG_TRANSITION}
        variants={MOON_SVG_VARIANTS}
        viewBox="0 0 24 24"
        width="28"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        <title>Moon</title>
      </motion.svg>
    </div>
  );
});

MoonIcon.displayName = 'MoonIcon';

const CLOUD_VARIANTS: Variants = {
  normal: {
    x: 0,
    y: 0,
  },
  animate: {
    x: [-1, 1, -1, 1, 0],
    y: [-1, 1, -1, 1, 0],
    transition: {
      duration: 1,
      ease: 'easeInOut',
    },
  },
};

const SUN_VARIANTS: Variants = {
  normal: { opacity: 1 },
  animate: (i: number) => ({
    opacity: [0, 1],
    transition: { delay: i * 0.1, duration: 0.3 },
  }),
};

const CloudSunIcon = forwardRef<CloudSunIconHandle, HTMLAttributes<HTMLDivElement>>(({ onMouseEnter, onMouseLeave, className, ...props }, ref) => {
  const cloudControls = useAnimation();
  const sunControls = useAnimation();
  const isControlledRef = useRef(false);

  useImperativeHandle(ref, () => {
    isControlledRef.current = true;

    return {
      startAnimation: () => {
        cloudControls.start('animate');
        sunControls.start('animate');
      },
      stopAnimation: () => {
        cloudControls.start('normal');
        sunControls.start('normal');
      },
    };
  });

  const handleMouseEnter = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseEnter?.(e);
      } else {
        cloudControls.start('animate');
        sunControls.start('animate');
      }
    },
    [cloudControls, sunControls, onMouseEnter],
  );

  const handleMouseLeave = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseLeave?.(e);
      } else {
        cloudControls.start('normal');
        sunControls.start('normal');
      }
    },
    [cloudControls, sunControls, onMouseLeave],
  );

  return (
    <div className={cn(className)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
      <svg
        fill="none"
        height="28"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        style={{ overflow: 'visible' }}
        viewBox="0 0 24 24"
        width="28"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Cloud Sun</title>
        <motion.g animate={cloudControls} initial="normal" variants={CLOUD_VARIANTS}>
          <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
        </motion.g>
        {['M12 2v2', 'm4.93 4.93 1.41 1.41', 'M20 12h2', 'm19.07 4.93-1.41 1.41', 'M15.947 12.65a4 4 0 0 0-5.925-4.128'].map((d, index) => (
          <motion.path animate={sunControls} custom={index + 1} d={d} initial="normal" key={d} variants={SUN_VARIANTS} />
        ))}
      </svg>
    </div>
  );
});

CloudSunIcon.displayName = 'CloudSunIcon';

export interface SunIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export interface SunDimIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export interface MoonIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export interface CloudSunIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}
