import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, getChartColor } from '@/components/ui/chart';
import { Item, ItemContent, ItemDescription, ItemHeader, ItemTitle } from '@/components/ui/item';

export const description = 'A stacked bar chart with a legend';

const chartData = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 },
];

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: getChartColor(3),
  },
  mobile: {
    label: 'Mobile',
    color: getChartColor(9),
  },
} satisfies ChartConfig;

export function GraphBarStacked() {
  return (
    <Item variant="outline">
      <ItemHeader className="flex-col items-center justify-center">
        <ItemTitle>Bar Chart - Stacked + Legend</ItemTitle>
        <ItemDescription>Description</ItemDescription>
      </ItemHeader>
      <ItemContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={(value) => value.slice(0, 3)} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="desktop" stackId="a" fill={getChartColor(0)} radius={[0, 0, 4, 4]} />
            <Bar dataKey="mobile" stackId="a" fill={getChartColor(1)} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </ItemContent>
    </Item>
  );
}
