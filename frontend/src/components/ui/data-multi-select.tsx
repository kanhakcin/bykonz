import type { UseQueryResult } from '@tanstack/react-query';
import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils/cn.util';

export function DataMultiSelect<TQuery = unknown, TMapped = TQuery>({
  id,
  placeholder = 'Select options...',
  value = [],
  onChange,
  query,
  mapToOptions,
  valueKey = 'id',
  labelKey = 'name',
  noOptionsMessage = 'No options available.',
  noResultsMessage = 'No results found.',
  disabled = false,
  className,
  searchPlaceholder = 'Search...',
  maxShownItems = 3,
  variant = 'basic',
}: DataMultiSelectProps<TQuery, TMapped>) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, isError } = query;

  // Auto-map if mapToOptions not provided
  const options = data
    ? mapToOptions
      ? mapToOptions(data)
      : (data as any[]).map((item) => ({
          value: item[valueKey],
          label: item[labelKey],
          data: item,
        }))
    : [];

  const selectedValues = value || [];

  const toggleSelection = (optionValue: string) => {
    const newValues = selectedValues.includes(optionValue) ? selectedValues.filter((v) => String(v) !== optionValue) : [...selectedValues, optionValue];

    const selectedOptions = options.filter((opt) => newValues.includes(String(opt.value)));
    onChange(newValues, selectedOptions);
  };

  const removeSelection = (optionValue: string | number) => {
    const newValues = selectedValues.filter((v) => String(v) !== String(optionValue));
    const selectedOptions = options.filter((opt) => newValues.includes(String(opt.value)));
    onChange(newValues, selectedOptions);
  };

  const visibleItems = expanded ? selectedValues : selectedValues.slice(0, maxShownItems);
  const hiddenCount = selectedValues.length - visibleItems.length;

  return (
    <div className={cn('w-full', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} variant={variant} role="combobox" aria-expanded={open} disabled={disabled || isLoading} className="w-full justify-between">
            <div className="flex flex-wrap items-center gap-1 pr-2.5">
              {isLoading ? (
                <span className="text-muted-foreground">Loading...</span>
              ) : selectedValues.length > 0 ? (
                <>
                  {visibleItems.map((val) => {
                    const option = options.find((opt) => String(opt.value) === String(val));
                    return option ? (
                      <Badge key={String(val)} variant="outline" className="rounded-sm">
                        {option.label}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSelection(val);
                          }}
                          asChild
                        >
                          <span>
                            <XIcon className="size-3" />
                          </span>
                        </Button>
                      </Badge>
                    ) : null;
                  })}
                  {hiddenCount > 0 || expanded ? (
                    <Badge
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded((prev) => !prev);
                      }}
                      className="cursor-pointer rounded-sm"
                    >
                      {expanded ? 'Show Less' : `+${hiddenCount} more`}
                    </Badge>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDownIcon className="shrink-0 text-muted-foreground/80" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              {isError ? (
                <CommandEmpty>Error loading options.</CommandEmpty>
              ) : options.length === 0 ? (
                <CommandEmpty>{noOptionsMessage}</CommandEmpty>
              ) : (
                <>
                  <CommandEmpty>{noResultsMessage}</CommandEmpty>
                  <CommandGroup>
                    {options.map((option) => (
                      <CommandItem key={String(option.value)} value={String(option.value)} onSelect={() => toggleSelection(String(option.value))}>
                        <span className="truncate">{option.label}</span>
                        {selectedValues.includes(String(option.value)) && <CheckIcon size={16} className="ml-auto" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export interface DataMultiSelectOption<T = unknown> {
  value: string | number;
  label: string;
  data?: T;
}

interface DataMultiSelectProps<TQuery = unknown, TMapped = TQuery> {
  /** Optional id for external label association */
  id?: string;
  /** Visual variant of the trigger button */
  variant?: 'basic' | 'default';
  /** Placeholder text when no values are selected */
  placeholder?: string;
  /** Currently selected values */
  value?: (string | number)[];
  /** Callback when selection changes */
  onChange: (values: (string | number)[], options: DataMultiSelectOption<TMapped>[]) => void;
  /** TanStack Query result containing the data */
  query: UseQueryResult<TQuery[], Error>;
  /** Function to map query data to select options (optional if valueKey/labelKey provided) */
  mapToOptions?: (data: TQuery[]) => DataMultiSelectOption<TMapped>[];
  /** Key to use as value from data objects (default: 'id') */
  valueKey?: string;
  /** Key to use as label from data objects (default: 'name') */
  labelKey?: string;
  /** Message to show when no options are available */
  noOptionsMessage?: string;
  /** Message to show when search returns no results */
  noResultsMessage?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Maximum number of badges to show before collapsing */
  maxShownItems?: number;
}
