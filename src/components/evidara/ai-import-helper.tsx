'use client';

import { useMemo, useState } from 'react';
import { Bot, Check, Copy, Download, ExternalLink, FileCode2, FileSpreadsheet, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { downloadBlob } from '@/lib/simpleZip';

const aiPreflightRules = `IMPORTANT — DO THIS BEFORE YOU CREATE THE FINAL FILE:\n1. Inspect the complete source first and identify the exam/curriculum, subject mix and whether the paper spans more than one grade.\n2. Classification is part of the conversion job. Every question MUST have a non-empty grade, subject, chapter, topic and difficulty. Do not leave taxonomy blank simply because the source paper did not print it.\n3. Infer chapter/topic from the actual question, options and supplied solution. Use the most specific defensible topic and canonical syllabus names. If web/search is available, verify uncertain syllabus mapping against the official/current curriculum before finalising.\n4. For NEET/NCERT papers, classify each question to the appropriate Grade 11 or Grade 12 chapter. NEET commonly mixes both grades, so DO NOT ask me to choose one grade for the whole paper. For JEE, use the corresponding standard Class 11/12 syllabus mapping.\n5. If the board/exam/grade policy truly cannot be inferred with high confidence, ASK ME the minimum clarifying question BEFORE generating the final file. Do not guess silently. Do not ask me to classify chapter/topic question-by-question; that is your job.\n6. Preserve the source wording, equations, option order and supplied answer key. Classification may be inferred; question/answer content must not be invented.\n7. Before delivery, run a preflight: no blank grade/subject/chapter/topic/difficulty fields; question count matches source; all image references resolve to real packaged files.\n8. For images, support question, option and solution images, including multiple images in one solution. Use only the exact path inside the ZIP. If anything is genuinely missing, report it as Question N — question/option/solution — exact/path.png. Never include surrounding prose as part of an image filename.\n9. PLAN THE PAPER SECTIONS BEFORE converting. Detect every subject present in the source and assign each question the correct canonical subject. For a mixed NEET paper, use Physics, Chemistry and Biology as separate subject groups; do NOT label the whole paper Biology just because the last/current question is Biology. For JEE, normally use Physics, Chemistry and Mathematics. Preserve explicit source sections when they exist.\n10. The final conversion report MUST include a Section plan with each detected subject/section and its question count. Evidara uses the per-question subject field to create subject sections automatically, so subject names must be consistent across all questions (for example exactly Physics, Chemistry, Biology).\n\nIf a required clarification is needed, ask it first and STOP. Only produce the final Evidara file after the clarification is resolved.`;

const latexPrompt = `${aiPreflightRules}\n\nConvert EVERY question into Evidara structured LaTeX. Use exactly one block per question:\n\\begin{question}\n\\exam{NEET}\n\\grade{Grade 11}\n\\subject{Physics}\n\\chapter{Laws of Motion}\n\\topic{Friction}\n\\difficulty{moderate}\n\\marks{4}\n\\negative_marks{1}\n\\question{Question text here}\n\\questionimage{assets/q001.png}\n\\option[A]{Option A}\n\\optionimage[A]{assets/q001-a.png}\n\\option[B]{Option B}\n\\option[C]{Option C}\n\\option[D]{Option D}\n\\answer{A}\n\\solution{Solution only if supplied in the source}\n\\end{question}\n\nOmit image commands when no image exists. You may also preserve inline \\includegraphics{assets/file.png}; every referenced file must exist. Never output \\grade{}, \\subject{}, \\chapter{}, \\topic{} or \\difficulty{} in a final ready file. Before the question blocks, report the detected section plan (for example Physics 45, Chemistry 45, Biology 90). Every question's \\subject{...} must match that plan so Evidara can create and populate the sections automatically.`;

const excelPrompt = `${aiPreflightRules}\n\nConvert the source into an Evidara-ready spreadsheet with one row per question using these columns:\nexam_types, grade, subject, chapter, topic, question_type, difficulty, question, question_latex, question_image, option_a, option_a_latex, option_a_image, option_b, option_b_latex, option_b_image, option_c, option_c_latex, option_c_image, option_d, option_d_latex, option_d_image, correct_answer, solution, solution_latex, marks, negative_marks, estimated_seconds, language, status, source, source_year, tags\n\nUse single_correct unless the source clearly indicates another type. Put relative ZIP paths such as assets/q017.png in image columns. Every final row must contain grade, subject, chapter, topic and difficulty. Return the table plus a short preflight report listing any source errata or unresolved content.`;

const zipPrompt = `${aiPreflightRules}\n\nPrepare ONE Evidara-ready ZIP bundle. The ZIP must contain exactly one question source file named questions.tex and an assets/ folder containing EVERY referenced image. Do not add a second CSV, Excel, TXT, PDF or DOCX question source.\n\nFor every question create an Evidara block with populated exam, grade, subject, chapter, topic, difficulty, marks, negative_marks, question, options, answer and supplied solution. Use explicit questionimage/optionimage commands when appropriate; inline \\includegraphics is also accepted. Multiple images inside a solution are valid and must all be packaged.\n\nFINAL ZIP GATE: do not give me the ZIP if any required classification field is blank, if any image reference is unresolved, or if the converted question count differs from the source. If a clarification is needed, ask me before creating the ZIP. Alongside the final ZIP, report: questions converted; grades detected; subjects detected; Section plan with per-subject question counts; classification completed; image references found; image files packaged; missing images (must be zero unless I explicitly accept an incomplete source); and answer-key/source anomalies. For a mixed paper, never collapse all questions into one subject/section.`;

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
