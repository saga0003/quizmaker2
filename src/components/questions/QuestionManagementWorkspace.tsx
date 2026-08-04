'use client';

import { useState } from 'react';
import { BookCopy, FileQuestion } from 'lucide-react';
import { LiveQuestionBank } from '@/components/evidara/live-question-bank';
import { QuestionCollectionsManager } from './QuestionCollectionsManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function QuestionManagementWorkspace({ kind }: { kind: 'admin' | 'school' }) {
  const [tab, setTab] = useState('bank');
  return <Tabs value={tab} onValueChange={setTab} className="space-y-5">
    <TabsList className="h-auto flex-wrap rounded-xl border border-[#DFE6EC] bg-white p-1.5 shadow-sm">
      <TabsTrigger value="bank" className="min-h-10 gap-2 px-5 data-[state=active]:bg-[#006B70] data-[state=active]:text-white"><FileQuestion className="h-4 w-4" />Question Bank</TabsTrigger>
      <TabsTrigger value="collections" className="min-h-10 gap-2 px-5 data-[state=active]:bg-[#006B70] data-[state=active]:text-white"><BookCopy className="h-4 w-4" />Question Collections</TabsTrigger>
    </TabsList>
    <TabsContent value="bank"><LiveQuestionBank kind={kind} /></TabsContent>
    <TabsContent value="collections"><QuestionCollectionsManager kind={kind} /></TabsContent>
  </Tabs>;
}
