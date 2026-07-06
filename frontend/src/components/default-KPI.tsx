import type { LucideIcon } from 'lucide-react';
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils/cn.util';

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  valueColor?: string;
  className?: string;
}

export function DefaultKPI({ title, value, icon: Icon, iconColor, change, changeType, valueColor, className }: KPICardProps) {
  return (
    <Item variant="outline" className={cn('flex-col', className)}>
      <ItemContent className="flex w-full flex-row items-center justify-between gap-2">
        {Icon && <Icon className={cn('size-5', iconColor)} />}
        <ItemDescription className="font-bold text-xs">{title}</ItemDescription>
        {change && <div className={cn('font-medium text-xs', changeType === 'positive' ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400')}>{change}</div>}
      </ItemContent>
      <ItemTitle className={cn('ml-6 font-bold text-2xl tracking-tight', valueColor)}>{value}</ItemTitle>
    </Item>
  );
}
