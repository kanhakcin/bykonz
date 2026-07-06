// extraido de https://rosencharts.com/

import { useMemo } from 'react';
import { Label, Pie, PieChart } from 'recharts';

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, getChartColor } from '@/components/ui/chart';
import { Item, ItemContent, ItemDescription, ItemHeader, ItemTitle } from '@/components/ui/item';

export const description = 'A donut chart with text and legend';

const data = [
  { browser: 'chrome', visitors: 275 },
  { browser: 'safari', visitors: 200 },
  { browser: 'firefox', visitors: 287 },
  { browser: 'edge', visitors: 173 },
  { browser: 'other', visitors: 190 },
];

const chartData = data.map((item, index) => ({
  ...item,
  fill: getChartColor(index),
}));

const chartConfig = {
  visitors: {
    label: 'Visitors',
  },
  chrome: {
    label: 'Chrome',
    color: getChartColor(0),
  },
  safari: {
    label: 'Safari',
    color: getChartColor(3),
  },
  firefox: {
    label: 'Firefox',
    color: getChartColor(6),
  },
  edge: {
    label: 'Edge',
    color: getChartColor(9),
  },
  other: {
    label: 'Other',
    color: getChartColor(12),
  },
} satisfies ChartConfig;

export function GraphPizza() {
  const totalVisitors = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.visitors, 0);
  }, []);

  return (
    <Item variant="outline">
      <ItemHeader className="flex-col items-center justify-center">
        <ItemTitle>Pie Chart - Donut with Text</ItemTitle>
        <ItemDescription>Description</ItemDescription>
      </ItemHeader>
      <ItemContent>
        {/* IMPORTANT: Do not use 'mx-auto' in ChartContainer className as it breaks the ResponsiveContainer layout */}
        <ChartContainer config={chartConfig} className="aspect-square max-h-80 w-full">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie data={chartData} dataKey="visitors" nameKey="browser" innerRadius={60} strokeWidth={5}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground font-bold text-3xl">
                          {totalVisitors.toLocaleString()}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">
                          Visitors
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-3 pt-2">
          {chartData.map((item) => (
            <div key={item.browser} className="flex basis-1/4 flex-col items-center gap-1">
              <div className="h-2 w-full shrink-0 rounded-[2px]" style={{ backgroundColor: item.fill }} />
              <ItemDescription className="text-center text-xs leading-none tracking-tight">{chartConfig[item.browser as keyof typeof chartConfig]?.label}</ItemDescription>
            </div>
          ))}
        </div>
      </ItemContent>
    </Item>
  );
}
