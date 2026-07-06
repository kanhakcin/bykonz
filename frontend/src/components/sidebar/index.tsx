import { LanguageSwitcher } from '@/components/nav-actions/switch-language';
import { SidebarSwitcher } from '@/components/nav-actions/switch-sidebar';
import { ThemeSwitcher } from '@/components/nav-actions/switch-theme';
import { FooterNavigation } from '@/components/sidebar/nav-footer';
import AppNavigation from '@/components/sidebar/nav-main';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils/cn.util';

export function AppSidebar() {
  const { state, setHovered } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar variant="floating" collapsible="icon" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} className="transition-all duration-300 ease-in-out">
      <SidebarHeader className="items-center pt-3">
        <div className="flex items-center gap-1 py-1">
          <div className={cn('flex items-center', isCollapsed && 'flex-col')}>
            <SidebarSwitcher />
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-1">
              <LanguageSwitcher />
              <ThemeSwitcher />
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-1 text-muted-foreground">
        <AppNavigation />
      </SidebarContent>
      <SidebarFooter className="px-2 pb-3">
        <FooterNavigation />
      </SidebarFooter>
    </Sidebar>
  );
}
