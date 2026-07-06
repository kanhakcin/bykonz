import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';

const data = [
  {
    name: 'Requests',
    stat: '996',
    limit: '10,000',
    percentage: 9.96,
  },
  {
    name: 'Storage',
    stat: '1.85',
    limit: '10GB',
    percentage: 18.5,
  },
  {
    name: 'API Calls',
    stat: '4,328',
    limit: '5,000',
    percentage: 86.56,
  },
];

export function GraphProgress() {
  return (
    <div className="flex flex-col gap-4">
      {data.map((item) => (
        <Item key={item.name} variant="outline">
          <ItemContent>
            <ItemDescription>{item.name}</ItemDescription>
            <ItemTitle className="break-all font-semibold text-2xl">{item.stat}</ItemTitle>
            <Progress value={item.percentage} className="h-6" />
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>{item.percentage}&#37;</span>
              <ItemDescription className="line-clamp-none">
                {item.stat} of {item.limit}
              </ItemDescription>
            </div>
          </ItemContent>
        </Item>
      ))}
    </div>
  );
}
