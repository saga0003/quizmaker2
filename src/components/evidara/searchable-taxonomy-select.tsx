'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type SearchableOption = {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
};

export function SearchableTaxonomySelect({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText = 'No matching item found.',
  disabled = false,
  allowClear = false,
  clearLabel = 'None',
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ordered = useMemo(
    () => [...options].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
    [options],
  );
  const selected = ordered.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full min-w-0 justify-between border-[#E7ECEB] bg-white px-3 font-normal text-[#14232B]"
        >
          <span className={cn('truncate text-left', !selected && 'text-[#6B7980]')}>
            {selected?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-[#6B7980]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder || `Search ${placeholder.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 px-4 py-3 text-[#6B7980]">
                <Search className="h-4 w-4" />
                <span>{emptyText}</span>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value={`clear ${clearLabel}`}
                  onSelect={() => {
                    onValueChange('');
                    setOpen(false);
                  }}
                >
                  <Check className={cn('h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                  <span>{clearLabel}</span>
                </CommandItem>
              )}
              {ordered.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.description || ''} ${option.keywords || ''}`}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className="items-start"
                >
                  <Check className={cn('mt-0.5 h-4 w-4 shrink-0', value === option.value ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.description && <span className="block truncate text-xs text-[#6B7980]">{option.description}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
