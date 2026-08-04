'use client';

import { LivePaperCatalogueV8 } from '@/components/evidara/live-paper-catalogue-v8';

export function QuestionPaperList({ kind }: { kind: 'admin' | 'school' }) {
  return <LivePaperCatalogueV8 kind={kind} />;
}
