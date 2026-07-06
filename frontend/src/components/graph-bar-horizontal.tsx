import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, getChartColor } from '@/components/ui/chart';
import { Item, ItemContent, ItemDescription, ItemHeader, ItemTitle } from '@/components/ui/item';

export const description = 'A mixed bar chart';

const chartData = [
  { browser: 'chrome', visitors: 275, fill: getChartColor(3) },
  { browser: 'safari', visitors: 200, fill: getChartColor(6) },
  { browser: 'firefox', visitors: 187, fill: getChartColor(9) },
  { browser: 'edge', visitors: 173, fill: getChartColor(12) },
  { browser: 'other', visitors: 90, fill: getChartColor(15) },
];

const chartConfig = {
  visitors: {
    label: 'Visitors',
  },
  chrome: {
    label: 'Chrome',
    color: getChartColor(3),
  },
  safari: {
    label: 'Safari',
    color: getChartColor(6),
  },
  firefox: {
    label: 'Firefox',
    color: getChartColor(9),
  },
  edge: {
    label: 'Edge',
    color: getChartColor(12),
  },
  other: {
    label: 'Other',
    color: getChartColor(15),
  },
} satisfies ChartConfig;

export function GraphBarHorizontal() {
  return (
    <Item variant="outline" className="items-stretch">
      <ItemHeader className="flex-col items-center justify-center">
        <ItemTitle>Bar Chart - Horizontal</ItemTitle>
        <ItemDescription>Description</ItemDescription>
      </ItemHeader>
      <ItemContent>
        <ChartContainer config={chartConfig}>
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{
              left: 0,
            }}
          >
            <YAxis
              dataKey="browser"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => chartConfig[value as keyof typeof chartConfig]?.label || value}
            />
            <XAxis dataKey="visitors" type="number" hide />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="visitors" radius={5} />
          </BarChart>
        </ChartContainer>
      </ItemContent>
    </Item>
  );
}
