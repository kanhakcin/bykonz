import { useNavigate } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { buildSidebarRoutes } from '@/lib/config/sidebar-routes.config';
import { ItemTitle } from '../ui/item';
import { MobileSettings } from './mobile-settings';

export function TreeNavigation() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const sidebarRoutes = useMemo(() => buildSidebarRoutes(), []);

  const handleNavigate = (path: string) => {
    navigate({ to: path });
    setOpen(false);
  };

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 flex gap-2 border-t bg-background p-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="default" className="h-12 flex-1 rounded-xl">
            <Menu className="size-4" />
            <ItemTitle className="text-lg">{t('menu')}</ItemTitle>
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="flex max-h-[85vh] flex-col rounded-t-xl p-0 sm:max-w-none">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle>{t('menu')}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-4 pb-8">
            {sidebarRoutes.map((route) => (
              <Button key={route.id} variant="ghost" className="justify-start gap-2" onClick={() => handleNavigate(route.path)}>
                {route.icon && <route.icon className="size-4" />}
                {t(route.labelKey)}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <MobileSettings />
    </div>
  );
}
