import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * Criação rotas publicas
 * Estas não tem Layout
 */

function PublicLayout() {
  return <Outlet />;
}

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
});
