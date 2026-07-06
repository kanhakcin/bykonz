import { UserMenu } from '@/components/nav-actions/user-menu';
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';

export function FooterNavigation() {
  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex justify-center">
        <UserMenu />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
