import { Link, useMatchRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { buildSidebarRoutes } from '@/lib/config/sidebar-routes.config';
import { cn } from '@/lib/utils/cn.util';

function convertToNavRoutes(routes: ReturnType<typeof buildSidebarRoutes>, t: (key: string) => string): Route[] {
  return routes.map((route) => ({
    id: route.id,
    title: t(route.labelKey),
    icon: route.icon ? <route.icon className="size-4" /> : undefined,
    link: route.path,
  }));
}

export default function AppNavigation() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const matchRoute = useMatchRoute();

  const routes = useMemo(() => convertToNavRoutes(buildSidebarRoutes(), t), [t]);

  return (
    <SidebarMenu>
      {routes.map((route) => (
        <SidebarMenuItem key={route.id}>
          <SidebarMenuButton
            isActive={!!matchRoute({ to: route.link, fuzzy: true })}
            className={cn('text-muted-foreground hover:bg-sidebar-muted hover:text-foreground', isCollapsed && 'justify-center')}
            asChild
          >
            <Link to={route.link} className={cn('flex items-center gap-2 px-2', isCollapsed && 'justify-center')}>
              {route.icon}
              {!isCollapsed && <span>{route.title}</span>}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

type Route = {
  id: string;
  title: string;
  icon?: ReactNode;
  link: string;
};
