import { useMemo } from 'react';
import { getChartColor } from '@/components/ui/chart';
import { Item, ItemContent, ItemDescription, ItemFooter, ItemHeader, ItemTitle } from '@/components/ui/item';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn.util';

export interface GraphBreakPartsData {
  key: string;
  value: number;
  color?: string;
}

export interface GraphBreakPartsProps {
  title?: string;
  description?: string;
  data: GraphBreakPartsData[];
  formatValue?: (value: number) => string | number;
  unitLabel?: string;
  className?: string;
}

export function GraphBreakParts({ title, description, data, formatValue, unitLabel, className }: GraphBreakPartsProps) {
  const barHeight = 60;
  const cornerRadius = 8;

  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      color: item.color || getChartColor(index),
    }));
  }, [data]);

  const { processedData, total } = useMemo(() => {
    const total = chartData.reduce((acc, d) => acc + d.value, 0);
    let cumulativeWidth = 0;

    const itemsProcessed = chartData
      .map((d, index) => {
        const barWidth = total > 0 ? (d.value / total) * 100 : 0;
        const xPosition = cumulativeWidth;
        cumulativeWidth += barWidth;

        let borderRadius = '0';
        if (index === 0) {
          borderRadius = `${cornerRadius}px 0 0 ${cornerRadius}px`;
        } else if (index === chartData.length - 1) {
          borderRadius = `0 ${cornerRadius}px ${cornerRadius}px 0`;
        }

        // If only one item has value > 0, make it fully rounded
        const itemsWithValues = chartData.filter((x) => x.value > 0);
        if (itemsWithValues.length === 1 && d.value > 0) {
          borderRadius = `${cornerRadius}px`;
        }

        return {
          ...d,
          width: barWidth,
          left: xPosition,
          borderRadius,
        };
      })
      .filter((d) => d.value > 0);

    return { processedData: itemsProcessed, total };
  }, [chartData]);

  const displayFormat = formatValue || ((val: number) => val.toLocaleString());

  return (
    <Item variant="outline" className={cn(className)}>
      {(title || description) && (
        <ItemHeader className="flex-col items-center text-center">
          {title && <ItemTitle>{title}</ItemTitle>}
          {description && <ItemDescription>{description}</ItemDescription>}
        </ItemHeader>
      )}
      <ItemContent className="relative">
        {processedData.length > 0 ? (
          <div className="w-full" style={{ height: `${barHeight}px` }}>
            <TooltipProvider>
              {processedData.map((d) => (
                <Tooltip key={d.key}>
                  <TooltipTrigger asChild>
                    <div
                      className="group absolute cursor-help transition-all duration-300 hover:z-10 hover:brightness-110"
                      style={{
                        width: `${d.width}%`,
                        height: `${barHeight}px`,
                        left: `${d.left}%`,
                      }}
                    >
                      <div
                        className="h-full w-full border-white/5 border-y first:border-l last:border-r"
                        style={{
                          backgroundColor: d.color,
                          borderRadius: d.borderRadius,
                        }}
                      />

                      {d.width > 10 && (
                        <>
                          <div
                            className="pointer-events-none absolute w-full truncate px-1 text-center font-semibold text-white"
                            style={{
                              top: `${barHeight / 5}px`,
                              left: '50%',
                              transform: 'translateX(-50%)',
                            }}
                          >
                            <ItemDescription className="truncate font-semibold text-white drop-shadow-md">{d.key}</ItemDescription>
                          </div>
                          <div
                            className="pointer-events-none absolute w-full truncate px-1 text-center text-white"
                            style={{
                              top: `${barHeight * 0.45}px`,
                              left: '50%',
                              transform: 'translateX(-50%)',
                            }}
                          >
                            <p className="truncate font-bold font-mono text-lg text-white tabular-nums drop-shadow-md">{displayFormat(d.value)}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="flex min-w-32 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="size-3" style={{ backgroundColor: d.color }} />
                      <ItemTitle className="font-bold text-xs uppercase tracking-tight">{d.key}</ItemTitle>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <ItemTitle className="font-black text-lg tabular-nums">{displayFormat(d.value)}</ItemTitle>
                      {unitLabel && <ItemDescription className="font-normal text-xs uppercase">{unitLabel}</ItemDescription>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        ) : (
          <div className="flex w-full items-center justify-center rounded-lg border border-dashed p-4" style={{ height: `${barHeight}px` }}>
            <ItemDescription>Sem dados disponíveis</ItemDescription>
          </div>
        )}

        {/* Legend Pattern consistent with Pizza Chart */}
        <ItemFooter className="flex-wrap items-center justify-center gap-4">
          {chartData.map((item) => (
            <div key={item.key} className="flex flex-col items-center">
              <div className="flex items-baseline gap-2">
                <div className="size-2" style={{ backgroundColor: item.color }} />
                <ItemTitle className="font-semibold text-muted-foreground text-xs uppercase">{item.key}</ItemTitle>
              </div>
              <ItemTitle className="font-semibold text-lg tabular-nums">{displayFormat(item.value)}</ItemTitle>
              {total > 0 && <ItemDescription className="text-xs tabular-nums">{((item.value / total) * 100).toFixed(1)}%</ItemDescription>}
            </div>
          ))}
        </ItemFooter>
      </ItemContent>
    </Item>
  );
}
