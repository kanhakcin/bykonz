import { Link, useLocation, useMatches, useRouter } from '@tanstack/react-router';
import { CircleQuestionMark, Home, MoveLeft } from 'lucide-react';
import { type ComponentProps, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn.util';

function PageBreadcrumb() {
  const matches = useMatches();
  const location = useLocation();
  const { t } = useTranslation();
  const pathnames = location.pathname.split('/').filter(Boolean);

  if (pathnames.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">
              <Home className="size-4" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {pathnames.length > 0 && <BreadcrumbSeparator />}
        {pathnames.map((value, index) => {
          const isLast = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;

          const match = matches.find((m) => m.pathname === to || m.pathname === `${to}/`);
          let translatedValue = '';

          if (match?.staticData) {
            if (typeof match.staticData.getTitle === 'function') {
              translatedValue = match.staticData.getTitle();
            } else if (typeof match.staticData.title === 'string') {
              translatedValue = t(match.staticData.title);
            }
          }

          if (!translatedValue) {
            translatedValue = t(value.replaceAll('-', '.'));
          }

          return (
            <Fragment key={to}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{translatedValue}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={to as string}>{translatedValue}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function Card({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div data-slot="card" className={cn('flex min-w-0 flex-col gap-4 rounded-lg border-sidebar-border bg-background py-6 text-card-foreground md:border', className)} {...props}>
      <div className="-mb-2 flex items-center justify-between px-4 md:px-6">
        <PageBreadcrumb />
        <CardDescription />
      </div>
      {children}
    </div>
  );
}

function CardHeader({ className, title, children, ...props }: ComponentProps<'div'> & { title?: string }) {
  const location = useLocation();
  const matches = useMatches();
  const router = useRouter();
  const { t } = useTranslation();

  const getTitle = (title: string | undefined) => {
    if (title) return title;

    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      if (match?.staticData) {
        if (typeof match.staticData.getTitle === 'function') {
          return match.staticData.getTitle();
        }
        if (typeof match.staticData.title === 'string') {
          return t(match.staticData.title);
        }
      }
    }

    const pathnames = location.pathname.split('/').filter(Boolean);
    if (pathnames.length > 0) {
      return t(pathnames[pathnames.length - 1].replaceAll('-', '.'));
    }
  };

  const resolvedTitle = getTitle(title);

  return (
    <div data-slot="card-header" className={cn('flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2 md:px-6', className)} {...props}>
      <div className="flex min-w-0 items-center gap-2 md:gap-4">
        <Button size="icon" className="h-9 w-11 shrink-0 rounded-lg" onClick={() => router.history.back()}>
          <MoveLeft className="size-4" />
        </Button>
        {resolvedTitle && <CardTitle>{resolvedTitle}</CardTitle>}
      </div>
      {children ? <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:shrink-0">{children}</div> : null}
    </div>
  );
}

function CardTitle({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn('font-mono font-semibold text-2xl leading-none tracking-tight md:text-3xl', className)} {...props} />;
}

function CardDescription({ className, ...props }: ComponentProps<'div'>) {
  const matches = useMatches();
  const { t } = useTranslation();
  let description = '';

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    if (match?.staticData && typeof match.staticData.description === 'string') {
      description = t(match.staticData.description);
      break;
    }
  }

  if (!description) return null;

  return (
    <div data-slot="card-description" className={cn('flex items-center text-muted-foreground', className)} {...props}>
      <Tooltip>
        <TooltipTrigger asChild>
          <CircleQuestionMark className="size-5 cursor-help transition-colors hover:text-foreground" />
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs font-normal">
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function CardAction({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-action" className={cn('col-start-2 row-span-2 row-start-1 flex w-full justify-end gap-2 sm:w-auto sm:flex-row', className)} {...props} />;
}

function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('min-w-0 space-y-6 px-2 md:min-h-[70vh] md:px-6', className)} {...props} />;
}

function CardHeaderActions({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header-actions" className={cn('flex items-center gap-2', className)} {...props} />;
}

function CardFooter({ className, layout = 'simple', ...props }: CardFooterProps) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'mt-auto flex gap-4 px-4 text-sm md:px-6 md:text-base [.border-t]:pt-6',
        layout === 'simple' && 'items-center justify-end',
        layout === 'multi' && 'flex-col items-center justify-between sm:flex-row',
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardHeaderActions, CardTitle };

interface CardFooterProps extends ComponentProps<'div'> {
  layout?: 'simple' | 'multi';
}
