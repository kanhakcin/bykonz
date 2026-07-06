import type { LucideIcon } from 'lucide-react';
import { MAIN_ROUTES, ROUTE_ICONS } from './routes.config';

function toTranslationKey(segment: string): string {
  return segment.replace(/-/g, '.');
}

export function buildSidebarRoutes(): SidebarRoute[] {
  return MAIN_ROUTES.map((path) => {
    const section = path.split('/').filter(Boolean)[0];
    return {
      id: section,
      path,
      labelKey: toTranslationKey(section),
      icon: ROUTE_ICONS[section],
    };
  });
}

export interface SidebarRoute {
  id: string;
  path: string;
  labelKey: string;
  icon?: LucideIcon;
}
