import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import { ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/cn.util';

export default function DefaultFormLayout({ sections, layout = 'horizontal' }: DefaultFormLayoutProps) {
  return (
    <div className={cn('flex flex-col gap-8 p-4 md:p-10')}>
      <div className="flex flex-col gap-10">
        {sections.map((section, index) => {
          const sectionLayout = section.layout || layout;
          return (
            <Fragment key={section.title}>
              <FieldSet className={cn('block w-full border-none p-0', sectionLayout === 'horizontal' ? 'grid grid-cols-1 gap-10 md:grid-cols-3' : 'flex flex-col gap-6')}>
                <ItemContent className="gap-1">
                  <FieldLegend variant="label" className="m-0 p-0">
                    <ItemTitle className="font-semibold text-lg">{section.title}</ItemTitle>
                  </FieldLegend>
                  {section.description && <ItemDescription className="line-clamp-none">{section.description}</ItemDescription>}
                </ItemContent>

                <div className={cn(sectionLayout === 'horizontal' && 'md:col-span-2')}>
                  <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-6">
                    {section.fields.map((field) => (
                      <div key={section.title} className="col-span-full">
                        {field}
                      </div>
                    ))}
                  </FieldGroup>
                </div>
              </FieldSet>
              {index < sections.length - 1 && <Separator className="my-2" />}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export interface FormSection {
  title: string;
  description?: string;
  fields: ReactNode[];
  layout?: 'horizontal' | 'vertical';
}

interface DefaultFormLayoutProps {
  sections: FormSection[];
  layout?: 'horizontal' | 'vertical';
}
