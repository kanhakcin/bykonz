import { MinusIcon, PlusIcon } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export const title = 'Tabs with Left Plus Trigger';

const data: { value: string; title: string; content: string }[] = [];

const loremTitles = ['Lorem ipsum dolor sit amet', 'Consectetur adipiscing elit', 'Sed do eiusmod tempor', 'Incididunt ut labore et dolore'];

const loremParagraphs = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
];

for (const [index] of new Array(4).fill(0).entries()) {
  data.push({
    value: `lorem-${index + 1}`,
    title: loremTitles[index],
    content: loremParagraphs[index],
  });
}

const Example = () => (
  <Accordion className="flex w-full max-w-md flex-col gap-2" collapsible defaultValue={data[0].value} type="single">
    {data.map((item) => (
      <AccordionItem className="overflow-hidden rounded-lg border bg-background px-4 last:border-b" key={item.value} value={item.value}>
        <AccordionTrigger className="group hover:no-underline [&>svg]:hidden">
          <div className="flex w-full items-center gap-3">
            <div className="relative size-4 shrink-0">
              <PlusIcon className="absolute inset-0 size-4 text-muted-foreground transition-opacity duration-200 group-data-[state=open]:opacity-0" />
              <MinusIcon className="absolute inset-0 size-4 text-muted-foreground opacity-0 transition-opacity duration-200 group-data-[state=open]:opacity-100" />
            </div>
            <span className="flex-1 text-left">{item.title}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="ps-7">
          <p className="text-muted-foreground">{item.content}</p>
        </AccordionContent>
      </AccordionItem>
    ))}
  </Accordion>
);

export default Example;
