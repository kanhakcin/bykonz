import { TanStackDevtools } from '@tanstack/react-devtools';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { CircleAlert } from 'lucide-react';
import { createElement, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import DefaultEmptyData from '@/components/default-empty-data';
import DefaultLoading from '@/components/default-loading';
import { LanguageSwitcher } from '@/components/nav-actions/switch-language';
import { ThemeSwitcher } from '@/components/nav-actions/switch-theme';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';

export const Route = createRootRoute({
  notFoundComponent: () => {
    const { t } = useTranslation();
    return (
      <Card className="m-2">
        <CardHeader title={t('not.found.page')}>
          <div className="flex gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </CardHeader>
        <CardContent>
          <DefaultEmptyData />
        </CardContent>
      </Card>
    );
  },
  errorComponent: ({ error }) => {
    const { t } = useTranslation();
    return (
      <Card className="m-2">
        <CardHeader title={t('error.page')}>
          <div className="flex gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </CardHeader>
        <CardContent>
          <Empty className="border-2 border-destructive/20 bg-destructive/10">
            <EmptyHeader>
              <CircleAlert className="size-8 animate-pulse text-destructive" />
              <EmptyTitle className="text-destructive">{t('error.page')}</EmptyTitle>
              <EmptyDescription className="max-w-md break-all rounded-md border bg-background/50 p-4 font-mono text-xs">
                {error instanceof Error ? error.message : String(error)}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  },
  pendingComponent: () => {
    const { t } = useTranslation();
    return (
      <Card className="m-2">
        <CardHeader title={t('error.page')}>
          <div className="flex gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </CardHeader>
        <CardContent>
          <DefaultLoading />
        </CardContent>
      </Card>
    );
  },
  component: RootComponent,
});

function RootComponent() {
  return createElement(
    Fragment,
    null,
    createElement(Outlet),
    import.meta.env.DEV
      ? createElement(TanStackDevtools, {
          config: {
            position: 'bottom-right',
          },
          plugins: [
            {
              name: 'Tanstack Router',
              render: createElement(TanStackRouterDevtoolsPanel),
            },
          ],
        })
      : null,
  );
}
