import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/nav-actions/switch-language';
import { ThemeSwitcher } from '@/components/nav-actions/switch-theme';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ItemTitle } from '../ui/item';

export function MobileSettings() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="group relative size-12 shrink-0 rounded-xl bg-background">
          <Settings2 className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="flex flex-col gap-6 rounded-t-xl p-4 pb-10 sm:max-w-none">
        <SheetHeader className="text-left">
          <SheetTitle>{t('setup')}</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 justify-items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <LanguageSwitcher />
            <ItemTitle>{t('language')}</ItemTitle>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ThemeSwitcher />
            <ItemTitle>{t('theme')}</ItemTitle>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
