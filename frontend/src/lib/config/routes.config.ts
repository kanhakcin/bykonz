import type { LucideIcon } from 'lucide-react';
import { FileText, LayoutDashboard, NotebookPen } from 'lucide-react';

// Mapeamento de ícones por segmento de rota
export const ROUTE_ICONS: Record<string, LucideIcon> = {
  painel: LayoutDashboard,
  cadastros: NotebookPen,
  relatorios: FileText,
};

/**
 * Lista de rotas principais da aplicação.
 * Esta lista é derivada do FileRoutesByFullPath gerado pelo TanStack Router.
 *
 * NOTA: Mantenha sincronizado com as rotas disponíveis no projeto.
 */
export const MAIN_ROUTES = ['/painel/', '/cadastros/', '/relatorios/'] as const;

export type MainRoute = (typeof MAIN_ROUTES)[number];
