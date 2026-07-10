import { Outlet } from '@tanstack/react-router';
import { BarChart3, Boxes, ClipboardList, NotebookPen } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '@/components/nav-actions/switch-language';
import { ThemeSwitcher } from '@/components/nav-actions/switch-theme';

const pitchFeatures = [
  { icon: NotebookPen, key: 'diary' },
  { icon: Boxes, key: 'projects' },
  { icon: ClipboardList, key: 'assets' },
  { icon: BarChart3, key: 'reports' },
] as const;

export function AuthLayout({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-muted/40 p-10 lg:flex">
        <span className="font-bold text-lg">{t('app.name')}</span>

        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="font-bold text-2xl">{t('login.pitch.title')}</h2>
            <p className="text-balance text-muted-foreground text-sm">{t('login.pitch.subtitle')}</p>
          </div>

          <ul className="flex flex-col gap-5">
            {pitchFeatures.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">{t(`login.pitch.feature.${key}.title`)}</span>
                  <span className="text-muted-foreground text-sm">{t(`login.pitch.feature.${key}.description`)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-muted-foreground text-xs">
          {t('app.name')} powered by{' '}
          <a href="https://www.bykonz.com" target="_blank" rel="noreferrer" className="text-foreground hover:underline hover:decoration-dashed hover:underline-offset-4">
            Bykonz
          </a>{' '}
          © {new Date().getFullYear()}
        </p>
      </aside>

      <div className="flex flex-col items-center bg-background px-4">
        <header className="flex w-full max-w-md items-center justify-between py-6">
          <span className="font-bold text-lg lg:invisible">{t('app.name')}</span>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </header>

        <main className="flex w-full max-w-md flex-1 items-center justify-center">{children || <Outlet />}</main>

        <footer className="w-full py-4 text-center lg:hidden">
          <p className="text-muted-foreground text-xs">
            {t('app.name')} powered by{' '}
            <a href="https://www.bykonz.com" target="_blank" rel="noreferrer" className="text-foreground hover:underline hover:decoration-dashed hover:underline-offset-4">
              Bykonz
            </a>{' '}
            © {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}
