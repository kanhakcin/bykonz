import { Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { LanguageSwitcher } from '@/components/nav-actions/switch-language';
import { ThemeSwitcher } from '@/components/nav-actions/switch-theme';

export function AuthLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4">
      <header className="flex w-full max-w-md items-center justify-between py-6">
        <span className="font-bold text-lg">Diário de Obras</span>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex w-full max-w-md flex-1 items-center justify-center">{children || <Outlet />}</main>

      <footer className="w-full py-4 text-center">
        <p className="text-muted-foreground text-xs">
          Diário de Obras powered by{' '}
          <a href="https://www.bykonz.com" target="_blank" rel="noreferrer" className="text-foreground hover:underline hover:decoration-dashed hover:underline-offset-4">
            Bykonz
          </a>{' '}
          © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
