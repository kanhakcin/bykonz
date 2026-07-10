import type { LucideIcon } from 'lucide-react';
import { FileText, LayoutDashboard, NotebookPen } from 'lucide-react';

// Mapeamento de ícones por segmento de rota
export const ROUTE_ICONS: Record<string, LucideIcon> = {
  painel: LayoutDashboard,
  cadastros: NotebookPen,
  relatorios: FileText,
};

/**
 * Rotas principais da sidebar — UMA entrada por módulo (primeiro segmento).
 * Cada módulo tem seu hub `index.tsx`; as sub-rotas (ex.: /cadastros/obras)
 * aparecem dentro do hub, não na sidebar.
 *
 * NOTA: manter à mão. NÃO rodar `pnpm run routes` (extract-routes.config.ts):
 * o gerador expande módulos com várias sub-rotas em uma entrada por sub-rota,
 * duplicando o item (ex.: 5x "cadastros"). Ver [[no-git-stash-vite-running]].
 */
export const MAIN_ROUTES = ['/painel/', '/cadastros/', '/relatorios/'] as const;

export type MainRoute = (typeof MAIN_ROUTES)[number];
