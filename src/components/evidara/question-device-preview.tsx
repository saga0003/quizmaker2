'use client';

import { useState } from 'react';
import { CheckCircle2, Laptop, Smartphone, Tablet } from 'lucide-react';
import { BlockMath, InlineMath } from 'react-katex';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { QuestionOptionInput, QuestionType } from '@/types/questions';

export type QuestionPreviewValue = {
  stemText: string;
  stemLatex?: string;
  imageUrl?: string;
  passageText?: string;
  questionType: QuestionType;
  options: QuestionOptionInput[];
  numericAnswer?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  difficulty?: string;
  showCorrectAnswer?: boolean;
};

type DeviceMode = 'mobile' | 'tablet' | 'laptop';

const widths: Record<DeviceMode, string> = {
  mobile: 'max-w-[390px]',
  tablet: 'max-w-[760px]',
  laptop: 'max-w-[1080px]',
};

function OptionContent({ option }: { option: QuestionOptionInput }) {
  return (
    <div className="min-w-0 flex-1">
      {option.content_text && <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#14232B]">{option.content_text}</p>}
      {option.content_latex && (
        <div className="mt-1 overflow-x-auto text-sm">
          <InlineMath math={option.content_latex} />
        </div>
      )}
      {option.image_url && (
        <img
          src={option.image_url}
          alt={`Option ${option.option_key}`}
          className="mt-2 max-h-40 max-w-full rounded-lg border border-[#E7ECEB] object-contain"
        />
      )}
    </div>
  );
}

export function QuestionDevicePreview({
  value,
  initialDevice = 'laptop',
  compact = false,
}: {
  value: QuestionPreviewValue;
  initialDevice?: DeviceMode;
  compact?: boolean;
}) {
  const [device, setDevice] = useState<DeviceMode>(initialDevice);
  const usableOptions = value.options.filter((option) => option.content_text || option.content_latex || option.image_url);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong className="text-sm text-[#14232B]">Live learner preview</strong>
          <p className="text-xs text-[#6B7980]">Switch screen size without leaving the question.</p>
        </div>
        <div className="flex rounded-lg border border-[#E7ECEB] bg-white p-1">
          {([
            ['mobile', Smartphone, 'Mobile'],
            ['tablet', Tablet, 'Tablet'],
            ['laptop', Laptop, 'Laptop'],
          ] as const).map(([mode, Icon, label]) => (
            <Button
              key={mode}
              type="button"
              variant="ghost"
              size="sm"
              title={`${label} preview`}
              onClick={() => setDevice(mode)}
              className={cn('h-8 px-2 text-xs', device === mode && 'bg-[#DCE9E7] text-[#0E5A5A]')}
            >
              <Icon className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#E7ECEB] bg-[#EEF2F1] p-3 sm:p-5">
        <div className={cn('mx-auto w-full transition-all duration-200', widths[device])}>
          <div className={cn('overflow-hidden rounded-2xl border border-[#DCE3E1] bg-white shadow-sm', compact ? 'p-4' : 'p-5 sm:p-6')}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {value.subject && <Badge className="bg-[#DCE9E7] text-[#0E5A5A]">{value.subject}</Badge>}
              {value.chapter && <Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">{value.chapter}</Badge>}
              {value.topic && <Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">{value.topic}</Badge>}
              {value.difficulty && <Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">{value.difficulty.replaceAll('_', ' ')}</Badge>}
            </div>

            {value.passageText && (
              <div className="mb-4 rounded-xl border border-[#E7ECEB] bg-[#F7F9F7] p-4 text-sm leading-relaxed text-[#14232B] whitespace-pre-wrap">
                {value.passageText}
              </div>
            )}

            <div className="text-base font-medium leading-relaxed text-[#14232B] whitespace-pre-wrap">
              {value.stemText || 'Your question will appear here as you type.'}
            </div>
            {value.stemLatex && (
              <div className="mt-3 overflow-x-auto rounded-xl border border-[#E7ECEB] bg-[#FBFCFC] px-3 py-2">
                <BlockMath math={value.stemLatex} />
              </div>
            )}
            {value.imageUrl && (
              <img
                src={value.imageUrl}
                alt="Question attachment"
                className="mx-auto mt-4 max-h-80 max-w-full rounded-xl border border-[#E7ECEB] object-contain"
              />
            )}

            {usableOptions.length > 0 && (
              <div className="mt-5 space-y-2.5">
                {usableOptions.map((option) => (
                  <div
                    key={option.option_key}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3.5',
                      value.showCorrectAnswer && option.is_correct
                        ? 'border-[#0E5A5A] bg-[#DCE9E7]/45'
                        : 'border-[#E7ECEB] bg-white',
                    )}
                  >
                    <span className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold',
                      value.showCorrectAnswer && option.is_correct
                        ? 'border-[#0E5A5A] bg-[#0E5A5A] text-white'
                        : 'border-[#D0D8D6] text-[#14232B]',
                    )}>
                      {option.option_key}
                    </span>
                    <OptionContent option={option} />
                    {value.showCorrectAnswer && option.is_correct && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0E5A5A]" />}
                  </div>
                ))}
              </div>
            )}

            {!usableOptions.length && value.numericAnswer && value.showCorrectAnswer && (
              <div className="mt-5 rounded-xl border border-[#0E5A5A]/20 bg-[#DCE9E7]/45 p-3 text-sm text-[#0E5A5A]">
                Correct answer: <strong>{value.numericAnswer}</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
