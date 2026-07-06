import { CartesianGrid, Line, LineChart, XAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, getChartColor } from '@/components/ui/chart';
import { Item, ItemContent, ItemDescription, ItemHeader, ItemTitle } from '@/components/ui/item';

export const description = 'A multiple line chart';

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
    color: getChartColor(6),
  },
} satisfies ChartConfig;

export function GraphLines() {
  return (
    <Item variant="outline">
      <ItemHeader className="flex-col items-center justify-center">
        <ItemTitle>Line Chart - Multiple</ItemTitle>
        <ItemDescription>Description</ItemDescription>
      </ItemHeader>
      <ItemContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value.slice(0, 3)} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line dataKey="desktop" type="monotone" stroke={getChartColor(0)} strokeWidth={2} dot={false} />
            <Line dataKey="mobile" type="monotone" stroke={getChartColor(1)} strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </ItemContent>
    </Item>
  );
}
