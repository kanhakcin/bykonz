import type { LucideIcon } from 'lucide-react';
import { MAIN_ROUTES, ROUTE_ICONS } from './routes.config';

export function buildSidebarRoutes(): SidebarRoute[] {
  return MAIN_ROUTES.map((path) => {
    const section = path.split('/').filter(Boolean)[0];
    return {
      id: section,
      path,
      // Usa `<módulo>.title` (chave existente), não o segmento cru.
      labelKey: `${section}.title`,
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
