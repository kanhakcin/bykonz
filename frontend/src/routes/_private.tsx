import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AppSidebar } from '@/components/sidebar';
import { TreeNavigation } from '@/components/tree-navigation';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils/cn.util';

/**
 * Criando Rotas Privadas
 * Layout route para rotas privadas (com autenticação)
 * Redireciona para /auth se não estiver autenticado
 */

function PrivateLayout() {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={false}>
      <main className={cn('relative flex min-h-screen w-full md:bg-accent', isMobile && 'pb-16')}>
        {!isMobile && <AppSidebar />}
        {/* representa a Main */}
        <SidebarInset>
          <div className="md:p-2.5 md:pl-1">
            <Outlet />
          </div>
        </SidebarInset>
        {isMobile && <TreeNavigation />}
      </main>
    </SidebarProvider>
  );
}

export const Route = createFileRoute('/_private')({
  beforeLoad: async () => {
    const { isAuthenticated } = useAuth.getState();

    if (!isAuthenticated) {
      throw redirect({
        to: '/auth',
      });
    }
  },
  component: PrivateLayout,
});
