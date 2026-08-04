'use client';

import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function HelpIcon({ text }: { text: string }) {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Show guidance"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#6B7980] transition hover:bg-[#DCE9E7] hover:text-[#0E5A5A] focus:outline-none focus:ring-2 focus:ring-[#0E5A5A]/30"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function GuidedLabel({
  children,
  help,
  required = false,
}: {
  children: React.ReactNode;
  help?: string;
  required?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <Label className="min-w-0 break-words text-sm font-medium leading-5 text-[#14232B]">
        {children}{required ? ' *' : ''}
      </Label>
      {help ? <HelpIcon text={help} /> : null}
    </div>
  );
}
