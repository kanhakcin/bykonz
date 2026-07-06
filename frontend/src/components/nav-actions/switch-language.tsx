import type { Variants } from 'framer-motion';
import { motion, useAnimation } from 'framer-motion';
import { forwardRef, type HTMLAttributes, type MouseEvent, useCallback, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLocale } from '@/hooks/use-locale';
import { useSidebarToggle } from '@/hooks/use-sidebar-toggle';
import { LANGUAGE_NAMES, LANGUAGES } from '@/lib/const/select-options.const';
import { cn } from '@/lib/utils/cn.util';

const availableLocales = LANGUAGES.map((l) => l.value);

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const { setMenuOpen } = useSidebarToggle();

  return (
    <DropdownMenu onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Switch language">
          <LanguagesIcon className="flex h-full w-full items-center justify-center" />
          <span className="sr-only">{t('language')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableLocales.map((lang) => (
          <DropdownMenuItem key={lang} onClick={() => setLocale(lang)} className={locale === lang ? 'bg-accent' : ''}>
            {LANGUAGE_NAMES[lang]}
            {locale === lang && ' ✓'}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PATH_VARIANTS: Variants = {
  normal: { opacity: 1, pathLength: 1, pathOffset: 0 },
  animate: (custom: number) => ({
    opacity: [0, 1],
    pathLength: [0, 1],
    pathOffset: [1, 0],
    transition: {
      opacity: { duration: 0.01, delay: custom * 0.1 },
      pathLength: {
        type: 'spring',
        duration: 0.5,
        bounce: 0,
        delay: custom * 0.1,
      },
    },
  }),
};

const SVG_VARIANTS: Variants = {
  normal: { opacity: 1 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const LanguagesIcon = forwardRef<LanguagesIconHandle, HTMLAttributes<HTMLDivElement>>(({ onMouseEnter, onMouseLeave, className, ...props }, ref) => {
  const svgControls = useAnimation();
  const pathControls = useAnimation();

  const isControlledRef = useRef(false);

  useImperativeHandle(ref, () => {
    isControlledRef.current = true;

    return {
      startAnimation: () => {
        svgControls.start('animate');
        pathControls.start('animate');
      },
      stopAnimation: () => {
        svgControls.start('normal');
        pathControls.start('normal');
      },
    };
  });

  const handleMouseEnter = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseEnter?.(e);
      } else {
        svgControls.start('animate');
        pathControls.start('animate');
      }
    },
    [onMouseEnter, pathControls, svgControls],
  );

  const handleMouseLeave = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseLeave?.(e);
      } else {
        svgControls.start('normal');
        pathControls.start('normal');
      }
    },
    [svgControls, pathControls, onMouseLeave],
  );

  return (
    <div role="button" className={cn(className)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
      <motion.svg
        animate={svgControls}
        fill="none"
        height="28"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        variants={SVG_VARIANTS}
        viewBox="0 0 24 24"
        width="28"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.path animate={pathControls} custom={3} d="m5 8 6 6" variants={PATH_VARIANTS} />
        <motion.path animate={pathControls} custom={2} d="m4 14 6-6 3-3" variants={PATH_VARIANTS} />
        <motion.path animate={pathControls} custom={1} d="M2 5h12" variants={PATH_VARIANTS} />
        <motion.path animate={pathControls} custom={0} d="M7 2h1" variants={PATH_VARIANTS} />
        <motion.path animate={pathControls} custom={3} d="m22 22-5-10-5 10" variants={PATH_VARIANTS} />
        <motion.path animate={pathControls} custom={3} d="M14 18h6" variants={PATH_VARIANTS} />
        <title>Languages</title>
      </motion.svg>
    </div>
  );
});

LanguagesIcon.displayName = 'LanguagesIcon';

export interface LanguagesIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}
