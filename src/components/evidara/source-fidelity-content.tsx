/* eslint-disable @next/next/no-img-element */
'use client';

import { cn } from '@/lib/utils';

export type SourceFidelitySegment = {
  page?: number;
  viewBox: [number, number, number, number];
  asset?: string;
  url?: string;
  standalone?: boolean;
  sourceViewBox?: [number, number, number, number];
};

export type SourceFidelityRender = {
  version?: string;
  mode?: string;
  asset_kind?: string;
  prompt_segments?: SourceFidelitySegment[];
  solution_segments?: SourceFidelitySegment[];
  answer_controls?: string;
  text_fallback?: boolean;
  font_policy?: string;
  source_pdf_page_size?: [number, number];
};

export function sourceFidelityFromMetadata(metadata: unknown): SourceFidelityRender | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).v19_render;
  if (!raw || typeof raw !== 'object') return null;
  const render = raw as SourceFidelityRender;
  if (render.mode !== 'source_fidelity') return null;
  return render;
}

function validSegment(segment: SourceFidelitySegment) {
  return Boolean(segment?.url && Array.isArray(segment.viewBox) && segment.viewBox.length === 4 && segment.viewBox.every((value) => Number.isFinite(Number(value))));
}

export function SourceFidelityContent({
  segments,
  pageSize = [612, 792],
  className,
  label = 'Source-faithful question content',
}: {
  segments?: SourceFidelitySegment[] | null;
  pageSize?: [number, number];
  className?: string;
  label?: string;
}) {
  const usable = (segments || []).filter(validSegment);
  if (!usable.length) return null;

  return (
    <div className={cn('source-fidelity-content space-y-3', className)}>
      {usable.map((segment, index) => {
        const [x, y, width, height] = segment.viewBox.map(Number) as [number, number, number, number];
        if (segment.standalone) {
          return (
            <img
              key={`${segment.url}-${segment.page || 0}-${index}`}
              src={segment.url}
              alt={`${label}${usable.length > 1 ? `, part ${index + 1}` : ''}`}
              width={Math.max(1, Math.round(width))}
              height={Math.max(1, Math.round(height))}
              className="block h-auto w-full"
              loading="lazy"
            />
          );
        }
        return (
          <svg
            key={`${segment.url}-${segment.page || 0}-${index}`}
            viewBox={`${x} ${y} ${width} ${height}`}
            preserveAspectRatio="xMinYMin meet"
            role="img"
            aria-label={`${label}${usable.length > 1 ? `, part ${index + 1}` : ''}`}
            className="block h-auto w-full overflow-visible"
          >
            <image
              href={segment.url}
              x="0"
              y="0"
              width={pageSize[0]}
              height={pageSize[1]}
              preserveAspectRatio="none"
            />
          </svg>
        );
      })}
    </div>
  );
}
