'use client';

import { useMemo, useState } from 'react';
import { Bot, Check, Copy, Download, ExternalLink, FileCode2, FileSpreadsheet, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { downloadBlob } from '@/lib/simpleZip';

const latexPrompt = `You are preparing a question bank for Evidara. I will upload a question paper/document. Convert EVERY question faithfully into the structured LaTeX below. Do not solve, rewrite, simplify or invent content. Preserve equations, option order and supplied answers. If taxonomy is unknown, leave it blank rather than guessing.\n\nUse exactly one block per question:\n\\begin{question}\n\\exam{NEET}\n\\grade{Grade 12}\n\\subject{Physics}\n\\chapter{Laws of Motion}\n\\topic{Friction}\n\\difficulty{moderate}\n\\marks{4}\n\\negative_marks{1}\n\\question{Question text here}\n\\questionimage{assets/q001.png}\n\\option[A]{Option A}\n\\optionimage[A]{assets/q001-a.png}\n\\option[B]{Option B}\n\\option[C]{Option C}\n\\option[D]{Option D}\n\\answer{A}\n\\solution{Solution only if supplied in the source}\n\\end{question}\n\nOmit questionimage/optionimage when there is no image. Keep every referenced image filename exactly consistent with the ZIP. Evidara also accepts \\includegraphics{assets/file.png} immediately after a question or option, but questionimage/optionimage is preferred because placement is explicit. At the end, report uncertain answer keys, missing images or unreadable questions.`;

const excelPrompt = `I will upload a question paper/document. Convert it into an Evidara-ready spreadsheet. Do not rewrite or solve questions. Preserve the answer key exactly as supplied. Create one row per question using these columns:\nexam_types, grade, subject, chapter, topic, question_type, difficulty, question, question_latex, question_image, option_a, option_a_latex, option_a_image, option_b, option_b_latex, option_b_image, option_c, option_c_latex, option_c_image, option_d, option_d_latex, option_d_image, correct_answer, solution, solution_latex, marks, negative_marks, estimated_seconds, language, status, source, source_year, tags\n\nFor images, put relative ZIP paths such as assets/q017.png or assets/q017-a.png in the corresponding question_image/option image column. Use single_correct unless the source clearly indicates another type. If subject/chapter/topic are unknown, leave them blank rather than guessing. Return an XLSX/CSV-compatible table and separately list uncertain rows.`;

const zipPrompt = `I will upload a question paper/document and its images. Prepare ONE Evidara-ready ZIP bundle. The ZIP must contain exactly one question source file named questions.tex and an assets/ folder with every referenced image. Do not add a second CSV, Excel, TXT, PDF or DOCX question source. Preserve question order, wording, equations, options and supplied answer keys; do not solve or invent content.\n\nFor each question use Evidara blocks such as:\n\\begin{question}\n\\exam{NEET}\n\\grade{Grade 12}\n\\subject{Physics}\n\\chapter{}\n\\topic{}\n\\difficulty{moderate}\n\\marks{4}\n\\negative_marks{1}\n\\question{Question text}\n\\questionimage{assets/q001.png}\n\\option[A]{Option A}\n\\optionimage[A]{assets/q001-a.png}\n\\option[B]{Option B}\n\\option[C]{Option C}\n\\option[D]{Option D}\n\\answer{A}\n\\solution{Only the supplied solution}\n\\end{question}\n\nOmit image commands when no image exists. Keep paths exact and case-consistent. Use unique image filenames. Before finalising the ZIP, report missing/ambiguous images or unreadable questions.`;

export function AiImportHelper() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<'latex' | 'excel' | 'zip'>('latex');
  const prompt = useMemo(() => format === 'latex' ? latexPrompt : format === 'excel' ? excelPrompt : zipPrompt, [format]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadPrompt() {
    downloadBlob(new Blob([prompt], { type: 'text/plain;charset=utf-8' }), `evidara-ai-${format}-conversion-prompt.txt`);
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="group flex h-full min-h-[118px] w-full items-start gap-3 rounded-2xl border border-[#BFD5FF] bg-gradient-to-br from-[#F8FBFF] to-[#F7F5FF] p-4 text-left transition hover:border-[#8FB4FF] hover:shadow-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#4267D5] shadow-sm"><Sparkles className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[#14232B]">AI Helper</strong><span className="rounded-full bg-[#ECE9FF] px-2 py-0.5 text-[10px] font-semibold text-[#6557C7]">Works with any AI</span></span>
        <span className="mt-1 block text-xs leading-5 text-[#6B7980]">Have a Word, PDF, Excel or old question paper? Get a ready prompt that converts it to Evidara LaTeX, Excel or ZIP.</span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#4267D5]">Open AI helper <ExternalLink className="h-3 w-3" /></span>
      </span>
    </button>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-[#E3E8EC] sm:max-w-3xl">
        <DialogHeader>
          <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-[#EEF2FF] text-[#5266D8]"><Bot className="h-5 w-5" /></div>
          <DialogTitle>AI conversion helper</DialogTitle>
          <DialogDescription>Use ChatGPT, Gemini, Claude or any other AI that accepts your source file. Evidara gives you the exact conversion instructions; no paid AI connection is required.</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-[#DCE9E7] bg-[#F7FBFA] p-4 text-sm leading-6 text-[#31505A]">
          <strong>Simple workflow:</strong> download or copy the prompt → open your preferred AI → attach the original question document → paste the prompt → upload the resulting LaTeX/Excel/ZIP back into Evidara.
        </div>

        <Tabs value={format} onValueChange={(value) => setFormat(value as 'latex' | 'excel' | 'zip')}>
          <TabsList className="grid h-auto grid-cols-3 bg-[#F1F4F5] p-1">
            <TabsTrigger value="latex"><FileCode2 className="mr-2 h-4 w-4" />LaTeX</TabsTrigger>
            <TabsTrigger value="excel"><FileSpreadsheet className="mr-2 h-4 w-4" />Excel / CSV</TabsTrigger>
            <TabsTrigger value="zip"><Download className="mr-2 h-4 w-4" />LaTeX + images ZIP</TabsTrigger>
          </TabsList>
          <TabsContent value={format} className="mt-4">
            <Textarea readOnly value={prompt} rows={18} className="font-mono text-xs leading-5" />
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={downloadPrompt}><Download className="mr-2 h-4 w-4" />Download prompt</Button>
          <Button onClick={() => void copyPrompt()} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? 'Copied' : 'Copy prompt'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
