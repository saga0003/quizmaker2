"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock3,
  Copy,
  Eye,
  FileQuestion,
  Filter,
  GripVertical,
  ListChecks,
  LoaderCircle,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuestionScope } from "@/components/questions/useQuestionScope";
import { PaperGenerationPanel } from "@/components/papers/PaperGenerationPanel";
import type { TaxonomyChapter, TaxonomySubject, TaxonomyTopic } from "@/types/questions";
import type {
  PaperCreationMode,
  PaperDefinitionPayloadV8,
  PaperProgramme,
  PaperQuestionInput,
  PaperSectionInput,
  PaperType,
  PaperValidationResult,
  PaperWorkflowStatus,
} from "@/types/papers";

const paperTypes: Array<{ value: PaperType; label: string }> = [
  { value: "full_length_mock", label: "Full-length mock test" },
  { value: "subject_test", label: "Subject test" },
  { value: "chapter_test", label: "Chapter test" },
  { value: "topic_test", label: "Topic test" },
  { value: "unit_test", label: "Unit test" },
  { value: "diagnostic_test", label: "Diagnostic test" },
  { value: "scholarship_test", label: "Scholarship test" },
  { value: "previous_year_paper", label: "Previous-year paper" },
  { value: "practice_test", label: "Practice test" },
  { value: "foundation_test", label: "Foundation test" },
  { value: "school_test", label: "School test" },
  { value: "custom_test", label: "Custom test" },
];

const steps = [
  { key: "details", label: "Details", icon: FileQuestion },
  { key: "programme", label: "Programme", icon: BookOpenCheck },
  { key: "sections", label: "Sections", icon: ListChecks },
  { key: "questions", label: "Questions", icon: Search },
  { key: "blueprint", label: "Blueprint", icon: Sparkles },
  { key: "arrangement", label: "Arrangement", icon: GripVertical },
  { key: "rules", label: "Marks & rules", icon: Settings2 },
  { key: "preview", label: "Preview", icon: Eye },
] as const;

type StepKey = (typeof steps)[number]["key"];
type SaveState = "idle" | "saving" | "saved" | "unsaved" | "failed";

type QuestionSnapshot = {
  id: string;
  stem_text: string;
  stem_latex?: string | null;
  question_image_url?: string | null;
  passage_text?: string | null;
  question_type: string;
  difficulty: string;
  subject_id?: string | null;
  subject_name?: string | null;
  chapter_id?: string | null;
  chapter_name?: string | null;
  topic_id?: string | null;
  topic_name?: string | null;
  estimated_seconds?: number | null;
  options?: Array<{
    option_key: string;
    content_text?: string | null;
    content_latex?: string | null;
    image_url?: string | null;
  }>;
};

type SelectedQuestion = PaperQuestionInput & {
  snapshot: QuestionSnapshot;
  usage_count?: number;
};

type BankQuestion = {
  id: string;
  external_question_id: string | null;
  stem_text: string;
  question_image_url: string | null;
  subject_id: string | null;
  subject_name: string | null;
  chapter_id: string | null;
  chapter_name: string | null;
  topic_id: string | null;
  topic_name: string | null;
  difficulty: string;
  question_type: string;
  marks: number;
  negative_marks: number;
  estimated_seconds: number | null;
  language: string;
  usage_count: number;
  updated_at: string;
  total_count: number;
};

type Availability = {
  total_approved: number;
  unused: number;
  previously_used: number;
  by_difficulty: Record<string, number>;
  by_question_type: Record<string, number>;
  status: "ready" | "warning" | "insufficient" | "no_questions";
};

const newId = () => crypto.randomUUID();
const emptySection = (order = 0): PaperSectionInput => ({
  client_id: newId(),
  title: `Section ${String.fromCharCode(65 + Math.min(order, 25))}`,
  code: `SEC-${order + 1}`,
  description: "",
  instructions: "",
  selection_mode: "manual",
  is_optional: false,
  display_order: order,
});

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readable(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normaliseSubjectCode(value: string) {
  const code = value.toUpperCase().replace(/[^A-Z]/g, "");
  if (["PHYSICS", "PHY", "PHYS"].includes(code)) return "PHY";
  if (["CHEMISTRY", "CHEM", "CHE"].includes(code)) return "CHEM";
  if (["MATHEMATICS", "MATHS", "MATH", "MAT"].includes(code)) return "MAT";
  if (["BIOLOGY", "BIO"].includes(code)) return "BIO";
  if (["LOGICALREASONING", "REASONING", "LR"].includes(code)) return "LR";
  return code;
}

export function QuestionPaperBuilder({ kind }: { kind: "admin" | "school" }) {
  const {
    organizationId,
    organizationName,
    loading: scopeLoading,
    error: scopeError,
  } = useQuestionScope(kind);
  const base = kind === "admin" ? "/admin/papers" : "/school/papers";

  const [routeReady, setRouteReady] = useState(false);
  const [paperId, setPaperId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<PaperWorkflowStatus>("draft");
  const [loading, setLoading] = useState(true);
  const [migrationReady, setMigrationReady] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeStep, setActiveStep] = useState<StepKey>("details");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const dirtyVersion = useRef(0);
  const saveInFlight = useRef(false);

  const [programmes, setProgrammes] = useState<PaperProgramme[]>([]);
  const [subjects, setSubjects] = useState<TaxonomySubject[]>([]);
  const [chapters, setChapters] = useState<TaxonomyChapter[]>([]);
  const [topics, setTopics] = useState<TaxonomyTopic[]>([]);

  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [detailedDescription, setDetailedDescription] = useState("");
  const [paperType, setPaperType] = useState<PaperType>("custom_test");
  const [academicYear, setAcademicYear] = useState("");
  const [language, setLanguage] = useState("English");
  const [tagsText, setTagsText] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [instructions, setInstructions] = useState("");
  const [programmeCode, setProgrammeCode] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [creationMode, setCreationMode] = useState<PaperCreationMode>("manual");

  const [sections, setSections] = useState<PaperSectionInput[]>([emptySection()]);
  const [activeSectionId, setActiveSectionId] = useState("");
  const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>([]);

  const [durationMinutes, setDurationMinutes] = useState(60);
  const [readingTimeMinutes, setReadingTimeMinutes] = useState(0);
  const [graceTimeMinutes, setGraceTimeMinutes] = useState(0);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [defaultPositiveMarks, setDefaultPositiveMarks] = useState<number | undefined>();
  const [defaultNegativeMarks, setDefaultNegativeMarks] = useState<number | undefined>();
  const [unansweredMarks, setUnansweredMarks] = useState(0);
  const [allowPartialMarking, setAllowPartialMarking] = useState(false);
  const [numericalTolerance, setNumericalTolerance] = useState<number | undefined>();
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [shuffleMode, setShuffleMode] = useState<"fixed" | "all" | "within_sections" | "sections">("fixed");
  const [preserveLockedPositions, setPreserveLockedPositions] = useState(true);
  const [allowPreviouslyUsed, setAllowPreviouslyUsed] = useState(true);
  const [preferUnused, setPreferUnused] = useState(false);
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [excludeUsedWithinDays, setExcludeUsedWithinDays] = useState<number | undefined>();
  const [excludeUsedMoreThan, setExcludeUsedMoreThan] = useState<number | undefined>();

  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [bankSubject, setBankSubject] = useState("all");
  const [bankChapter, setBankChapter] = useState("all");
  const [bankTopic, setBankTopic] = useState("all");
  const [bankDifficulty, setBankDifficulty] = useState("all");
  const [bankType, setBankType] = useState("all");
  const [bankPage, setBankPage] = useState(1);
  const [bankTotal, setBankTotal] = useState(0);
  const [bankSelection, setBankSelection] = useState<Set<string>>(new Set());
  const [availability, setAvailability] = useState<Availability | null>(null);
  const bankPageSize = 25;

  const [validation, setValidation] = useState<PaperValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    setPaperId(id);
    setRouteReady(true);
  }, []);

  const markDirty = useCallback(() => {
    dirtyVersion.current += 1;
    setDirty(true);
    setSaveState("unsaved");
    setValidation(null);
  }, []);

  const selectedProgramme = useMemo(
    () => programmes.find((programme) => programme.code === programmeCode) || null,
    [programmes, programmeCode],
  );

  const availableSubjects = useMemo(() => {
    if (!selectedProgramme || selectedProgramme.allowed_subject_codes.length === 0) return subjects;
    const allowed = new Set(selectedProgramme.allowed_subject_codes.map(normaliseSubjectCode));
    const matching = subjects.filter((subject) =>
      allowed.has(normaliseSubjectCode(subject.code || subject.name)),
    );
    return matching.length ? matching : subjects;
  }, [selectedProgramme, subjects]);

  const activeSection = useMemo(
    () => sections.find((section) => section.client_id === activeSectionId) || sections[0],
    [sections, activeSectionId],
  );

  const selectedIds = useMemo(
    () => new Set(selectedQuestions.map((question) => question.question_id)),
    [selectedQuestions],
  );

  const totalMarks = useMemo(
    () => selectedQuestions.reduce((sum, question) => sum + numberValue(question.marks), 0),
    [selectedQuestions],
  );
  const estimatedMinutes = useMemo(
    () =>
      Math.ceil(
        selectedQuestions.reduce(
          (sum, question) => sum + numberValue(question.snapshot.estimated_seconds),
          0,
        ) / 60,
      ),
    [selectedQuestions],
  );
  const requiredAttempts = useMemo(
    () =>
      sections.reduce((sum, section) => {
        const count = selectedQuestions.filter(
          (question) => question.section_client_id === section.client_id,
        ).length;
        return sum + Math.min(section.questions_to_attempt || count, count);
      }, 0),
    [sections, selectedQuestions],
  );

  const load = useCallback(async () => {
    if (!routeReady || !supabase) {
      if (routeReady) setLoading(false);
      return;
    }
    if (kind === "school" && scopeLoading) return;
    if (kind === "school" && !organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const [programmeResult, subjectResult, chapterResult, topicResult] = await Promise.all([
      supabase
        .from("paper_programmes")
        .select("id,code,name,category,grade_label,allowed_subject_codes,sort_order,is_active")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("subjects").select("id,name,code,organization_id").eq("is_active", true).order("name"),
      supabase.from("chapters").select("id,name,subject_id,organization_id").eq("is_active", true).order("name"),
      supabase.from("topics").select("id,name,chapter_id,organization_id").eq("is_active", true).order("name"),
    ]);

    if (programmeResult.error) {
      setMigrationReady(false);
      setError("V8 Papers requires Supabase migration 32. Apply it before using the new builder.");
      setLoading(false);
      return;
    }
    if (subjectResult.error || chapterResult.error || topicResult.error) {
      setError(
        subjectResult.error?.message ||
          chapterResult.error?.message ||
          topicResult.error?.message ||
          "Unable to load the academic taxonomy.",
      );
      setLoading(false);
      return;
    }

    setProgrammes((programmeResult.data || []) as PaperProgramme[]);
    setSubjects((subjectResult.data || []) as TaxonomySubject[]);
    setChapters((chapterResult.data || []) as TaxonomyChapter[]);
    setTopics((topicResult.data || []) as TaxonomyTopic[]);
    setMigrationReady(true);

    if (!paperId) {
      setActiveSectionId((current) => current || sections[0]?.client_id || "");
      setLoading(false);
      return;
    }

    const [paperResult, paperSubjectsResult, sectionsResult, questionsResult] = await Promise.all([
      supabase.from("question_papers").select("*").eq("id", paperId).single(),
      supabase.from("paper_subjects").select("subject_id,display_order").eq("paper_id", paperId).order("display_order"),
      supabase.from("paper_sections").select("*").eq("paper_id", paperId).order("display_order"),
      supabase
        .from("paper_questions")
        .select("id,question_id,section_id,display_order,marks,negative_marks,is_mandatory,is_locked,generation_source,shuffle_restricted,position_locked,is_bonus,is_cancelled,grace_marks,metadata,question_snapshot")
        .eq("paper_id", paperId)
        .order("display_order"),
    ]);

    if (paperResult.error || paperSubjectsResult.error || sectionsResult.error || questionsResult.error) {
      setError(
        paperResult.error?.message ||
          paperSubjectsResult.error?.message ||
          sectionsResult.error?.message ||
          questionsResult.error?.message ||
          "Unable to open this paper definition.",
      );
      setLoading(false);
      return;
    }

    const paper = paperResult.data;
    setTitle(paper.title || "");
    setCode(paper.code || "");
    setSlug(paper.slug || "");
    setDescription(paper.description || "");
    setDetailedDescription(paper.detailed_description || "");
    setPaperType((paper.paper_type || "custom_test") as PaperType);
    setAcademicYear(paper.academic_year || "");
    setLanguage(paper.language || "English");
    setTagsText((paper.tags || []).join(", "));
    setInternalNotes(paper.internal_notes || "");
    setInstructions(paper.instructions || "");
    setProgrammeCode(paper.programme_code || "");
    setSelectedSubjectIds((paperSubjectsResult.data || []).map((row) => row.subject_id));
    setCreationMode((paper.creation_mode || "manual") as PaperCreationMode);
    setWorkflowStatus((paper.workflow_status || paper.status || "draft") as PaperWorkflowStatus);
    setDurationMinutes(numberValue(paper.duration_minutes, 60));
    setReadingTimeMinutes(numberValue(paper.reading_time_minutes));
    setGraceTimeMinutes(numberValue(paper.grace_time_minutes));
    setAutoSubmit(paper.auto_submit ?? true);
    setDefaultPositiveMarks(paper.default_positive_marks ?? undefined);
    setDefaultNegativeMarks(paper.default_negative_marks ?? undefined);
    setUnansweredMarks(numberValue(paper.unanswered_marks));
    setAllowPartialMarking(Boolean(paper.allow_partial_marking));
    setNumericalTolerance(paper.numerical_tolerance ?? undefined);
    setShuffleQuestions(Boolean(paper.shuffle_questions));
    setShuffleOptions(Boolean(paper.shuffle_options));
    setShuffleMode(paper.shuffle_mode || "fixed");
    setPreserveLockedPositions(paper.preserve_locked_positions ?? true);
    setAllowPreviouslyUsed(paper.allow_previously_used ?? true);
    setPreferUnused(Boolean(paper.prefer_unused));
    setOnlyUnused(Boolean(paper.only_unused));
    setExcludeUsedWithinDays(paper.exclude_used_within_days ?? undefined);
    setExcludeUsedMoreThan(paper.exclude_used_more_than ?? undefined);
    setLastSavedAt(paper.last_saved_at || paper.updated_at || null);
    setRevision(numberValue(paper.draft_revision));

    const loadedSections: PaperSectionInput[] = (sectionsResult.data || []).map((section, index) => ({
      client_id: section.id,
      id: section.id,
      title: section.title,
      code: section.code || "",
      description: section.description || "",
      subject_id: section.subject_id || undefined,
      instructions: section.instructions || "",
      questions_to_attempt: section.questions_to_attempt ?? undefined,
      minimum_questions_to_attempt: section.minimum_questions_to_attempt ?? undefined,
      total_questions: section.total_questions ?? undefined,
      maximum_marks: section.maximum_marks ?? undefined,
      is_optional: Boolean(section.is_optional),
      selection_mode: (section.selection_mode || "manual") as PaperCreationMode,
      duration_minutes: section.duration_minutes ?? undefined,
      navigation_rules: section.navigation_rules || {},
      settings: section.settings || {},
      display_order: index,
    }));
    const safeSections = loadedSections.length ? loadedSections : [emptySection()];
    setSections(safeSections);
    setActiveSectionId(safeSections[0].client_id);

    setSelectedQuestions(
      (questionsResult.data || []).map((question) => ({
        question_id: question.question_id,
        section_client_id: question.section_id,
        display_order: numberValue(question.display_order),
        marks: numberValue(question.marks),
        negative_marks: numberValue(question.negative_marks),
        is_mandatory: question.is_mandatory ?? true,
        is_locked: Boolean(question.is_locked),
        generation_source: question.generation_source || "manual",
        shuffle_restricted: Boolean(question.shuffle_restricted),
        position_locked: Boolean(question.position_locked),
        is_bonus: Boolean(question.is_bonus),
        is_cancelled: Boolean(question.is_cancelled),
        grace_marks: numberValue(question.grace_marks),
        metadata: question.metadata || {},
        snapshot: question.question_snapshot as QuestionSnapshot,
      })),
    );
    setDirty(false);
    setSaveState("saved");
    setLoading(false);
  }, [kind, organizationId, paperId, routeReady, scopeLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(bankSearch.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [bankSearch]);

  const loadQuestionBank = useCallback(async () => {
    if (!supabase || !migrationReady || (kind === "school" && !organizationId)) return;
    setBankLoading(true);
    setBankError("");
    const usageRule = onlyUnused ? "only_unused" : preferUnused ? "prefer_unused" : "allow";
    const { data, error: searchError } = await supabase.rpc("search_eligible_questions_v8", {
      p_organization_id: kind === "admin" ? null : organizationId,
      p_programme_code: programmeCode || null,
      p_subject_id: bankSubject === "all" ? null : bankSubject,
      p_chapter_id: bankChapter === "all" ? null : bankChapter,
      p_topic_id: bankTopic === "all" ? null : bankTopic,
      p_difficulty: bankDifficulty === "all" ? null : bankDifficulty,
      p_question_type: bankType === "all" ? null : bankType,
      p_language: language || null,
      p_search: debouncedSearch || null,
      p_usage_rule: usageRule,
      p_excluded_ids: [],
      p_page: bankPage,
      p_page_size: bankPageSize,
    });
    if (searchError) {
      setBankError(searchError.message);
      setBankQuestions([]);
      setBankTotal(0);
    } else {
      const rows = (data || []) as BankQuestion[];
      setBankQuestions(rows);
      setBankTotal(rows.length ? Number(rows[0].total_count || rows.length) : 0);
    }
    setBankLoading(false);
  }, [
    migrationReady,
    kind,
    organizationId,
    programmeCode,
    bankSubject,
    bankChapter,
    bankTopic,
    bankDifficulty,
    bankType,
    language,
    debouncedSearch,
    onlyUnused,
    preferUnused,
    bankPage,
  ]);

  useEffect(() => {
    void loadQuestionBank();
  }, [loadQuestionBank]);

  useEffect(() => {
    const client = supabase;
    if (!client || !migrationReady || (kind === "school" && !organizationId)) return;
    const timer = window.setTimeout(async () => {
      const { data } = await client.rpc("paper_question_availability_v8", {
        p_organization_id: kind === "admin" ? null : organizationId,
        p_programme_code: programmeCode || null,
        p_subject_id: bankSubject === "all" ? null : bankSubject,
        p_chapter_id: bankChapter === "all" ? null : bankChapter,
        p_topic_id: bankTopic === "all" ? null : bankTopic,
        p_difficulty: bankDifficulty === "all" ? null : bankDifficulty,
        p_question_type: bankType === "all" ? null : bankType,
        p_excluded_ids: [],
      });
      if (data) setAvailability(data as Availability);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    migrationReady,
    kind,
    organizationId,
    programmeCode,
    bankSubject,
    bankChapter,
    bankTopic,
    bankDifficulty,
    bankType,
  ]);

  function buildPayload(): PaperDefinitionPayloadV8 {
    return {
      title: title.trim(),
      code: code.trim() || undefined,
      slug: slug.trim() || undefined,
      description: description.trim() || undefined,
      detailed_description: detailedDescription.trim() || undefined,
      paper_type: paperType,
      academic_year: academicYear.trim() || undefined,
      language,
      tags: tagsText
        .split(/[,|]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      internal_notes: internalNotes.trim() || undefined,
      programme_code: programmeCode || undefined,
      subject_ids: selectedSubjectIds,
      creation_mode: creationMode,
      duration_minutes: Math.max(1, durationMinutes || 60),
      reading_time_minutes: Math.max(0, readingTimeMinutes || 0),
      grace_time_minutes: Math.max(0, graceTimeMinutes || 0),
      auto_submit: autoSubmit,
      instructions: instructions.trim() || undefined,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
      shuffle_mode: shuffleMode,
      preserve_locked_positions: preserveLockedPositions,
      default_positive_marks: defaultPositiveMarks,
      default_negative_marks: defaultNegativeMarks,
      unanswered_marks: unansweredMarks,
      allow_partial_marking: allowPartialMarking,
      numerical_tolerance: numericalTolerance,
      allow_previously_used: allowPreviouslyUsed,
      prefer_unused: preferUnused,
      only_unused: onlyUnused,
      exclude_used_within_days: excludeUsedWithinDays,
      exclude_used_more_than: excludeUsedMoreThan,
      builder_settings: { active_step: activeStep },
      sections: sections.map((section, index) => ({ ...section, display_order: index })),
      questions: selectedQuestions.map((question, index) => ({
        question_id: question.question_id,
        section_client_id: question.section_client_id,
        display_order: index,
        marks: question.marks,
        negative_marks: question.negative_marks,
        is_mandatory: question.is_mandatory,
        is_locked: question.is_locked,
        generation_source: question.generation_source,
        shuffle_restricted: question.shuffle_restricted,
        position_locked: question.position_locked,
        is_bonus: question.is_bonus,
        is_cancelled: question.is_cancelled,
        grace_marks: question.grace_marks,
        metadata: question.metadata,
      })),
    };
  }

  const saveDraft = useCallback(
    async (silent = false) => {
      if (!supabase || !migrationReady || saveInFlight.current) return false;
      if (kind === "school" && !organizationId) {
        setError("School workspace not found.");
        return false;
      }
      saveInFlight.current = true;
      const capturedVersion = dirtyVersion.current;
      setSaveState("saving");
      if (!silent) {
        setError("");
        setNotice("");
      }
      const { data, error: saveError } = await supabase.rpc("save_paper_definition_v8", {
        p_paper_id: paperId,
        p_organization_id: kind === "admin" ? null : organizationId,
        p_payload: buildPayload(),
      });
      saveInFlight.current = false;
      if (saveError) {
        setSaveState("failed");
        setError(saveError.message);
        return false;
      }
      const result = data as {
        paper_id: string;
        code: string;
        revision: number;
        saved_at: string;
      };
      if (!paperId) {
        setPaperId(result.paper_id);
        window.history.replaceState(null, "", `${base}/new/?id=${result.paper_id}`);
      }
      setCode(result.code);
      setRevision(Number(result.revision || 0));
      setLastSavedAt(result.saved_at || new Date().toISOString());
      if (capturedVersion === dirtyVersion.current) {
        setDirty(false);
        setSaveState("saved");
      } else {
        setSaveState("unsaved");
      }
      if (!silent) setNotice("Draft saved. No paper was published or assigned to students.");
      return true;
    }, [
      migrationReady,
      kind,
      organizationId,
      paperId,
      title,
      code,
      slug,
      description,
      detailedDescription,
      paperType,
      academicYear,
      language,
      tagsText,
      internalNotes,
      programmeCode,
      selectedSubjectIds,
      creationMode,
      durationMinutes,
      readingTimeMinutes,
      graceTimeMinutes,
      autoSubmit,
      instructions,
      shuffleQuestions,
      shuffleOptions,
      shuffleMode,
      preserveLockedPositions,
      defaultPositiveMarks,
      defaultNegativeMarks,
      unansweredMarks,
      allowPartialMarking,
      numericalTolerance,
      allowPreviouslyUsed,
      preferUnused,
      onlyUnused,
      excludeUsedWithinDays,
      excludeUsedMoreThan,
      activeStep,
      sections,
      selectedQuestions,
      base,
    ],
  );

  useEffect(() => {
    if (!dirty || loading || !migrationReady) return;
    if (!title.trim() && !programmeCode && selectedQuestions.length === 0) return;
    const timer = window.setTimeout(() => void saveDraft(true), 1400);
    return () => window.clearTimeout(timer);
  }, [dirty, loading, migrationReady, title, programmeCode, selectedQuestions.length, saveDraft]);

  function updateField<T>(setter: (value: T) => void, value: T) {
    setter(value);
    markDirty();
  }

  function toggleSubject(subjectId: string) {
    setSelectedSubjectIds((current) =>
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId],
    );
    markDirty();
  }

  function addSection() {
    const section = emptySection(sections.length);
    setSections((current) => [...current, section]);
    setActiveSectionId(section.client_id);
    markDirty();
  }

  function updateSection(sectionId: string, patch: Partial<PaperSectionInput>) {
    setSections((current) =>
      current.map((section) => (section.client_id === sectionId ? { ...section, ...patch } : section)),
    );
    markDirty();
  }

  function removeSection(sectionId: string) {
    if (sections.length === 1) {
      setError("A paper must retain at least one section.");
      return;
    }
    if (selectedQuestions.some((question) => question.section_client_id === sectionId)) {
      setError("Move or remove this section's questions before deleting the section.");
      return;
    }
    const next = sections
      .filter((section) => section.client_id !== sectionId)
      .map((section, index) => ({ ...section, display_order: index }));
    setSections(next);
    if (activeSectionId === sectionId) setActiveSectionId(next[0].client_id);
    markDirty();
  }

  function duplicateSection(sectionId: string) {
    const source = sections.find((section) => section.client_id === sectionId);
    if (!source) return;
    const copy: PaperSectionInput = {
      ...source,
      id: undefined,
      client_id: newId(),
      title: `${source.title} Copy`,
      code: source.code ? `${source.code}-COPY` : `SEC-${sections.length + 1}`,
      display_order: sections.length,
    };
    setSections((current) => [...current, copy]);
    setActiveSectionId(copy.client_id);
    markDirty();
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    const index = sections.findIndex((section) => section.client_id === sectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next.map((section, order) => ({ ...section, display_order: order })));
    markDirty();
  }

  function bankToSelected(question: BankQuestion): SelectedQuestion {
    return {
      question_id: question.id,
      section_client_id: activeSection?.client_id || sections[0].client_id,
      display_order: selectedQuestions.length,
      marks: numberValue(question.marks, defaultPositiveMarks ?? 4),
      negative_marks: numberValue(question.negative_marks, defaultNegativeMarks ?? 1),
      is_mandatory: true,
      is_locked: activeSection?.selection_mode === "hybrid",
      generation_source: "manual",
      shuffle_restricted: false,
      position_locked: false,
      is_bonus: false,
      is_cancelled: false,
      grace_marks: 0,
      metadata: {},
      usage_count: question.usage_count,
      snapshot: {
        id: question.id,
        stem_text: question.stem_text,
        question_image_url: question.question_image_url,
        question_type: question.question_type,
        difficulty: question.difficulty,
        subject_id: question.subject_id,
        subject_name: question.subject_name,
        chapter_id: question.chapter_id,
        chapter_name: question.chapter_name,
        topic_id: question.topic_id,
        topic_name: question.topic_name,
        estimated_seconds: question.estimated_seconds,
      },
    };
  }

  function addQuestion(question: BankQuestion) {
    if (selectedIds.has(question.id)) return;
    if (!activeSection) {
      setError("Create and select a section before adding questions.");
      return;
    }
    setSelectedQuestions((current) => [...current, bankToSelected(question)]);
    markDirty();
  }

  function addBankSelection() {
    if (!activeSection) {
      setError("Select a destination section first.");
      return;
    }
    const additions = bankQuestions
      .filter((question) => bankSelection.has(question.id) && !selectedIds.has(question.id))
      .map(bankToSelected);
    if (additions.length === 0) return;
    setSelectedQuestions((current) => [...current, ...additions]);
    setBankSelection((current) => {
      const next = new Set(current);
      additions.forEach((question) => next.delete(question.question_id));
      return next;
    });
    markDirty();
  }

  function updateSelected(questionId: string, patch: Partial<SelectedQuestion>) {
    setSelectedQuestions((current) =>
      current.map((question) =>
        question.question_id === questionId ? { ...question, ...patch } : question,
      ),
    );
    markDirty();
  }

  function removeQuestion(questionId: string) {
    setSelectedQuestions((current) =>
      current
        .filter((question) => question.question_id !== questionId)
        .map((question, index) => ({ ...question, display_order: index })),
    );
    markDirty();
  }

  function moveQuestion(questionId: string, direction: "up" | "down" | "top" | "bottom") {
    const source = selectedQuestions.find((question) => question.question_id === questionId);
    if (!source || source.position_locked) return;
    const sectionItems = selectedQuestions.filter(
      (question) => question.section_client_id === source.section_client_id,
    );
    const sectionIndex = sectionItems.findIndex((question) => question.question_id === questionId);
    let targetSectionIndex = sectionIndex;
    if (direction === "up") targetSectionIndex = Math.max(0, sectionIndex - 1);
    if (direction === "down") targetSectionIndex = Math.min(sectionItems.length - 1, sectionIndex + 1);
    if (direction === "top") targetSectionIndex = 0;
    if (direction === "bottom") targetSectionIndex = sectionItems.length - 1;
    if (targetSectionIndex === sectionIndex) return;
    const targetId = sectionItems[targetSectionIndex].question_id;
    const sourceGlobal = selectedQuestions.findIndex((question) => question.question_id === questionId);
    const targetGlobal = selectedQuestions.findIndex((question) => question.question_id === targetId);
    const next = [...selectedQuestions];
    [next[sourceGlobal], next[targetGlobal]] = [next[targetGlobal], next[sourceGlobal]];
    setSelectedQuestions(next.map((question, index) => ({ ...question, display_order: index })));
    markDirty();
  }

  async function runValidation() {
    if (!supabase) return;
    const saved = await saveDraft(false);
    if (!saved || !paperId) {
      // paperId state updates after a new save; validation can be run on the next click.
      if (!paperId) setNotice("Draft created. Click Validate again to run the complete paper check.");
      return;
    }
    setValidating(true);
    setError("");
    const { data, error: validationError } = await supabase.rpc("validate_paper_v8", {
      p_paper_id: paperId,
    });
    setValidating(false);
    if (validationError) {
      setError(validationError.message);
      return;
    }
    setValidation(data as PaperValidationResult);
  }

  async function submitForReview() {
    if (!supabase || !paperId) {
      setError("Save the draft before submitting it for review.");
      return;
    }
    const saved = await saveDraft(false);
    if (!saved) return;
    setSubmittingReview(true);
    const { error: statusError } = await supabase.rpc("set_paper_workflow_status_v8", {
      p_paper_id: paperId,
      p_next_status: "submitted_for_review",
      p_reason: null,
    });
    setSubmittingReview(false);
    if (statusError) {
      setError(statusError.message);
      return;
    }
    setWorkflowStatus("submitted_for_review");
    setNotice("Paper submitted for review. It remains unavailable to students and products.");
  }

  const filteredChapters = useMemo(
    () =>
      bankSubject === "all"
        ? chapters
        : chapters.filter((chapter) => chapter.subject_id === bankSubject),
    [chapters, bankSubject],
  );
  const filteredTopics = useMemo(
    () =>
      bankChapter === "all"
        ? topics
        : topics.filter((topic) => topic.chapter_id === bankChapter),
    [topics, bankChapter],
  );
  const pageCount = Math.max(1, Math.ceil(bankTotal / bankPageSize));

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#667085" }}>
        <LoaderCircle className="spin" size={28} /> Loading V8 Paper Builder…
      </div>
    );
  }

  if (!migrationReady) {
    return (
      <div className="rm-card" style={{ padding: 30, maxWidth: 760 }}>
        <AlertCircle size={34} color="#B42318" />
        <h1 style={{ color: "#131E35" }}>V8 database setup required</h1>
        <p style={{ color: "#667085", lineHeight: 1.65 }}>
          Run <strong>supabase/32_v8_paper_builder_foundation.sql</strong> after migrations 1–31,
          then reload this page. V8 does not fall back to browser-only paper data.
        </p>
        <Link href={`${base}/`} className="rm-btn-secondary">
          <ArrowLeft size={16} /> Back to papers
        </Link>
      </div>
    );
  }

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "failed"
          ? "Save failed"
          : dirty
            ? "Unsaved changes"
            : "Draft ready";

  return (
    <div className="v8-paper-builder">
      <header className="v8-paper-header rm-card">
        <div className="v8-paper-title">
          <Link href={`${base}/`} className="v8-back-link">
            <ArrowLeft size={16} /> Papers
          </Link>
          <div>
            <div className="v8-title-row">
              <strong>{title.trim() || "Untitled paper"}</strong>
              <span className="rm-badge">{workflowStatus.replaceAll("_", " ")}</span>
              <span className="rm-badge">V8</span>
            </div>
            <div className="v8-header-meta">
              {selectedProgramme?.name || "No programme selected"} · {selectedQuestions.length} questions · {totalMarks} marks
            </div>
          </div>
        </div>
        <div className="v8-save-actions">
          <div className={`v8-save-state ${saveState}`}>
            {saveState === "saving" ? (
              <LoaderCircle className="spin" size={14} />
            ) : saveState === "saved" ? (
              <Check size={14} />
            ) : (
              <CircleDashed size={14} />
            )}
            <span>{saveLabel}</span>
            {lastSavedAt && (
              <small>{new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
            )}
          </div>
          <button className="rm-btn-secondary" onClick={() => setActiveStep("preview")}>
            <Eye size={16} /> Preview
          </button>
          <button className="rm-btn-primary" onClick={() => void saveDraft(false)} disabled={saveState === "saving"}>
            <Save size={16} /> Save Draft
          </button>
        </div>
      </header>

      {(scopeError || error) && <div className="v8-message error">{scopeError || error}</div>}
      {notice && <div className="v8-message success">{notice}</div>}

      <div className="v8-builder-layout">
        <nav className="v8-step-nav rm-card" aria-label="Paper builder steps">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <button
                key={step.key}
                type="button"
                className={activeStep === step.key ? "active" : ""}
                onClick={() => setActiveStep(step.key)}
              >
                <span>{index + 1}</span>
                <Icon size={16} />
                {step.label}
              </button>
            );
          })}
        </nav>

        <main className="v8-workspace rm-card">
          {activeStep === "details" && (
            <section>
              <div className="v8-step-heading">
                <div>
                  <span className="rm-label">Step 1</span>
                  <h1>Paper details</h1>
                  <p>Describe the reusable test-paper definition. No product or student-access setting belongs here.</p>
                </div>
              </div>
              <div className="v8-form-grid three">
                <label className="wide-two">
                  <span>Test-paper name</span>
                  <input className="rm-input" value={title} onChange={(event) => updateField(setTitle, event.target.value)} placeholder="Foundation Grade 8 Diagnostic Test" />
                </label>
                <label>
                  <span>Internal paper code</span>
                  <input className="rm-input" value={code} onChange={(event) => updateField(setCode, event.target.value.toUpperCase())} placeholder="Generated on save" />
                </label>
                <label>
                  <span>Paper type</span>
                  <select className="rm-input" value={paperType} onChange={(event) => updateField(setPaperType, event.target.value as PaperType)}>
                    {paperTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Academic year</span>
                  <input className="rm-input" value={academicYear} onChange={(event) => updateField(setAcademicYear, event.target.value)} placeholder="2026–27" />
                </label>
                <label>
                  <span>Language</span>
                  <select className="rm-input" value={language} onChange={(event) => updateField(setLanguage, event.target.value)}>
                    {['English','Kannada','Hindi','Bilingual'].map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label>
                  <span>Internal/public slug</span>
                  <input className="rm-input" value={slug} onChange={(event) => updateField(setSlug, event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="foundation-grade-8-diagnostic-01" />
                </label>
                <label className="wide-three">
                  <span>Short description</span>
                  <textarea className="rm-input" rows={2} value={description} onChange={(event) => updateField(setDescription, event.target.value)} placeholder="A concise internal summary" />
                </label>
                <label className="wide-three">
                  <span>Detailed description</span>
                  <textarea className="rm-input" rows={4} value={detailedDescription} onChange={(event) => updateField(setDetailedDescription, event.target.value)} placeholder="Coverage, intended level and paper purpose" />
                </label>
                <label className="wide-two">
                  <span>Tags</span>
                  <input className="rm-input" value={tagsText} onChange={(event) => updateField(setTagsText, event.target.value)} placeholder="diagnostic, mechanics, term-1" />
                </label>
                <label className="wide-three">
                  <span>Instructions</span>
                  <textarea className="rm-input" rows={4} value={instructions} onChange={(event) => updateField(setInstructions, event.target.value)} placeholder="Paper-level instructions" />
                </label>
                <label className="wide-three">
                  <span>Internal notes</span>
                  <textarea className="rm-input" rows={3} value={internalNotes} onChange={(event) => updateField(setInternalNotes, event.target.value)} placeholder="Visible only to authorised staff" />
                </label>
              </div>
            </section>
          )}

          {activeStep === "programme" && (
            <section>
              <div className="v8-step-heading">
                <div>
                  <span className="rm-label">Step 2</span>
                  <h1>Programme and subjects</h1>
                  <p>One primary programme controls eligible subjects and Question Bank matching.</p>
                </div>
              </div>
              <div className="v8-programme-grid">
                {programmes.map((programme) => (
                  <button
                    type="button"
                    key={programme.code}
                    className={programmeCode === programme.code ? "selected" : ""}
                    onClick={() => {
                      updateField(setProgrammeCode, programme.code);
                      setBankPage(1);
                    }}
                  >
                    <strong>{programme.name}</strong>
                    <span>{programme.category}</span>
                    {programmeCode === programme.code && <CheckCircle2 size={18} />}
                  </button>
                ))}
              </div>
              <div className="v8-subject-panel">
                <div>
                  <span className="rm-label">Subjects in this paper</span>
                  <h2>{selectedProgramme?.name || "Select a programme first"}</h2>
                </div>
                <div className="v8-subject-grid">
                  {availableSubjects.map((subject) => {
                    const selected = selectedSubjectIds.includes(subject.id);
                    return (
                      <button type="button" key={subject.id} className={selected ? "selected" : ""} onClick={() => toggleSubject(subject.id)}>
                        <span>{selected ? <Check size={16} /> : <Plus size={16} />}</span>
                        <strong>{subject.name}</strong>
                        <small>{subject.code}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="v8-mode-select">
                <span>Default paper creation mode</span>
                <select className="rm-input" value={creationMode} onChange={(event) => updateField(setCreationMode, event.target.value as PaperCreationMode)}>
                  <option value="manual">Manual selection</option>
                  <option value="automatic">Automatic blueprint</option>
                  <option value="hybrid">Hybrid locked + generated</option>
                </select>
              </label>
            </section>
          )}

          {activeStep === "sections" && (
            <section>
              <div className="v8-step-heading split">
                <div>
                  <span className="rm-label">Step 3</span>
                  <h1>Section builder</h1>
                  <p>Create, duplicate and arrange subject or rule-based sections.</p>
                </div>
                <button className="rm-btn-secondary" onClick={addSection}><Plus size={16} /> Add section</button>
              </div>
              <div className="v8-section-list">
                {sections.map((section, index) => {
                  const assigned = selectedQuestions.filter((question) => question.section_client_id === section.client_id).length;
                  return (
                    <article key={section.client_id} className={activeSectionId === section.client_id ? "active" : ""}>
                      <div className="v8-section-toolbar">
                        <button type="button" className="section-index" onClick={() => setActiveSectionId(section.client_id)}>{index + 1}</button>
                        <strong>{section.title || `Section ${index + 1}`}</strong>
                        <span>{assigned} questions</span>
                        <div>
                          <button title="Move up" onClick={() => moveSection(section.client_id, -1)}><ArrowUp size={15} /></button>
                          <button title="Move down" onClick={() => moveSection(section.client_id, 1)}><ArrowDown size={15} /></button>
                          <button title="Duplicate section structure" onClick={() => duplicateSection(section.client_id)}><Copy size={15} /></button>
                          <button title="Delete section" onClick={() => removeSection(section.client_id)}><Trash2 size={15} /></button>
                        </div>
                      </div>
                      <div className="v8-form-grid three">
                        <label className="wide-two"><span>Section name</span><input className="rm-input" value={section.title} onChange={(event) => updateSection(section.client_id, { title: event.target.value })} /></label>
                        <label><span>Section code</span><input className="rm-input" value={section.code || ""} onChange={(event) => updateSection(section.client_id, { code: event.target.value.toUpperCase() })} /></label>
                        <label><span>Subject</span><select className="rm-input" value={section.subject_id || ""} onChange={(event) => updateSection(section.client_id, { subject_id: event.target.value || undefined })}><option value="">Mixed subjects</option>{subjects.filter((subject) => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(subject.id)).map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label>
                        <label><span>Selection mode</span><select className="rm-input" value={section.selection_mode || "manual"} onChange={(event) => updateSection(section.client_id, { selection_mode: event.target.value as PaperCreationMode })}><option value="manual">Manual</option><option value="automatic">Automatic</option><option value="hybrid">Hybrid</option></select></label>
                        <label><span>Total planned questions</span><input type="number" min={0} className="rm-input" value={section.total_questions ?? ""} onChange={(event) => updateSection(section.client_id, { total_questions: event.target.value ? Number(event.target.value) : undefined })} /></label>
                        <label><span>Questions students must answer</span><input type="number" min={0} className="rm-input" value={section.questions_to_attempt ?? ""} onChange={(event) => updateSection(section.client_id, { questions_to_attempt: event.target.value ? Number(event.target.value) : undefined })} /></label>
                        <label><span>Minimum attempts</span><input type="number" min={0} className="rm-input" value={section.minimum_questions_to_attempt ?? ""} onChange={(event) => updateSection(section.client_id, { minimum_questions_to_attempt: event.target.value ? Number(event.target.value) : undefined })} /></label>
                        <label><span>Section duration (minutes)</span><input type="number" min={0} className="rm-input" value={section.duration_minutes ?? ""} onChange={(event) => updateSection(section.client_id, { duration_minutes: event.target.value ? Number(event.target.value) : undefined })} /></label>
                        <label className="checkbox-label"><input type="checkbox" checked={Boolean(section.is_optional)} onChange={(event) => updateSection(section.client_id, { is_optional: event.target.checked })} /> Optional section</label>
                        <label className="wide-three"><span>Description</span><textarea rows={2} className="rm-input" value={section.description || ""} onChange={(event) => updateSection(section.client_id, { description: event.target.value })} /></label>
                        <label className="wide-three"><span>Section instructions</span><textarea rows={3} className="rm-input" value={section.instructions || ""} onChange={(event) => updateSection(section.client_id, { instructions: event.target.value })} /></label>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {activeStep === "questions" && (
            <section>
              <div className="v8-step-heading split">
                <div>
                  <span className="rm-label">Step 4</span>
                  <h1>Question selection</h1>
                  <p>Server-side filters retrieve one page of approved questions at a time.</p>
                </div>
                <label className="v8-active-section"><span>Add to section</span><select className="rm-input" value={activeSection?.client_id || ""} onChange={(event) => setActiveSectionId(event.target.value)}>{sections.map((section) => <option key={section.client_id} value={section.client_id}>{section.title}</option>)}</select></label>
              </div>

              <div className="v8-availability">
                <div><strong>{availability?.total_approved ?? bankTotal}</strong><span>Approved available</span></div>
                <div><strong>{availability?.unused ?? 0}</strong><span>Unused</span></div>
                <div><strong>{availability?.previously_used ?? 0}</strong><span>Previously used</span></div>
                <div><strong>{bankTotal}</strong><span>Matching current filters</span></div>
                <div className={`availability-status ${availability?.status || "ready"}`}><ShieldCheck size={17} /><strong>{readable(availability?.status || "ready")}</strong></div>
              </div>

              <div className="v8-bank-filters">
                <div className="search-field"><Search size={16} /><input className="rm-input" value={bankSearch} onChange={(event) => { setBankSearch(event.target.value); setBankPage(1); }} placeholder="Question text, ID, external ID, chapter or topic" /></div>
                <select className="rm-input" value={bankSubject} onChange={(event) => { setBankSubject(event.target.value); setBankChapter("all"); setBankTopic("all"); setBankPage(1); }}><option value="all">All subjects</option>{subjects.filter((subject) => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(subject.id)).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
                <select className="rm-input" value={bankChapter} onChange={(event) => { setBankChapter(event.target.value); setBankTopic("all"); setBankPage(1); }}><option value="all">All chapters</option>{filteredChapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}</select>
                <select className="rm-input" value={bankTopic} onChange={(event) => { setBankTopic(event.target.value); setBankPage(1); }}><option value="all">All topics</option>{filteredTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select>
                <select className="rm-input" value={bankDifficulty} onChange={(event) => { setBankDifficulty(event.target.value); setBankPage(1); }}><option value="all">All difficulties</option>{['very_easy','easy','moderate','difficult','very_difficult'].map((value) => <option key={value} value={value}>{readable(value)}</option>)}</select>
                <select className="rm-input" value={bankType} onChange={(event) => { setBankType(event.target.value); setBankPage(1); }}><option value="all">All question types</option>{['single_correct','multiple_correct','numerical','integer','assertion_reason','match_following','passage','image_based'].map((value) => <option key={value} value={value}>{readable(value)}</option>)}</select>
              </div>

              <div className="v8-bank-bulkbar">
                <label><input type="checkbox" checked={bankQuestions.length > 0 && bankQuestions.every((question) => bankSelection.has(question.id) || selectedIds.has(question.id))} onChange={(event) => setBankSelection((current) => { const next = new Set(current); bankQuestions.forEach((question) => { if (!selectedIds.has(question.id)) { if (event.target.checked) next.add(question.id); else next.delete(question.id); } }); return next; })} /> Select visible</label>
                <span>{bankSelection.size} selected across pages</span>
                <button className="rm-btn-primary" disabled={bankSelection.size === 0} onClick={addBankSelection}><Plus size={16} /> Add selected to {activeSection?.title}</button>
              </div>

              {bankError && <div className="v8-message error">{bankError}</div>}
              <div className="v8-question-bank">
                {bankLoading ? <div className="v8-empty"><LoaderCircle className="spin" /> Loading approved questions…</div> : bankQuestions.length === 0 ? <div className="v8-empty"><Filter size={26} /><p>No approved questions match the current programme and filters.</p></div> : bankQuestions.map((question) => {
                  const included = selectedIds.has(question.id);
                  const checked = bankSelection.has(question.id);
                  return <article key={question.id} className={included ? "included" : ""}>
                    <label className="question-check"><input type="checkbox" disabled={included} checked={checked || included} onChange={(event) => setBankSelection((current) => { const next = new Set(current); if (event.target.checked) next.add(question.id); else next.delete(question.id); return next; })} /></label>
                    <div className="question-body">
                      <div className="question-labels"><span>{question.subject_name || 'Unclassified'}</span><span>{question.chapter_name || 'No chapter'}</span><span>{question.topic_name || 'No topic'}</span><span>{readable(question.difficulty)}</span><span>{readable(question.question_type)}</span></div>
                      <strong>{question.stem_text}</strong>
                      {question.question_image_url && <img src={question.question_image_url} alt="Question illustration" />}
                      <div className="question-meta"><span>ID {question.external_question_id || question.id.slice(0, 8)}</span><span>+{question.marks} / −{question.negative_marks}</span><span>{question.estimated_seconds ? `${question.estimated_seconds}s expected` : 'No time estimate'}</span><span>Used {question.usage_count} time{question.usage_count === 1 ? '' : 's'}</span></div>
                    </div>
                    <button className={included ? "rm-btn-secondary" : "rm-btn-primary"} disabled={included} onClick={() => addQuestion(question)}>{included ? <><Check size={15} /> Included</> : <><Plus size={15} /> Add</>}</button>
                  </article>;
                })}
              </div>
              <div className="v8-pagination"><button disabled={bankPage <= 1} onClick={() => setBankPage((page) => Math.max(1, page - 1))}><ChevronLeft size={16} /> Previous</button><span>Page {bankPage} of {pageCount} · {bankTotal} questions</span><button disabled={bankPage >= pageCount} onClick={() => setBankPage((page) => Math.min(pageCount, page + 1))}>Next <ChevronRight size={16} /></button></div>
            </section>
          )}

          {activeStep === "blueprint" && (
            <PaperGenerationPanel
              paperId={paperId}
              organizationId={kind === "admin" ? null : organizationId}
              programmeCode={programmeCode}
              subjects={subjects}
              chapters={chapters}
              topics={topics}
              onGenerated={() => void load()}
            />
          )}

          {activeStep === "arrangement" && (
            <section>
              <div className="v8-step-heading">
                <div><span className="rm-label">Step 5</span><h1>Question arrangement</h1><p>Number, move, lock, override marks or reassign questions without returning to the Question Bank.</p></div>
              </div>
              {selectedQuestions.length === 0 ? <div className="v8-empty"><FileQuestion size={30} /><p>Add questions before arranging the paper.</p></div> : <div className="v8-arrangement-list">
                {sections.map((section) => {
                  const items = selectedQuestions.filter((question) => question.section_client_id === section.client_id);
                  return <div key={section.client_id} className="arrangement-section"><div className="arrangement-heading"><div><strong>{section.title}</strong><span>{items.length} questions</span></div><span>{items.reduce((sum, item) => sum + numberValue(item.marks), 0)} marks</span></div>{items.length === 0 ? <div className="arrangement-empty">No questions assigned</div> : items.map((question) => {
                    const paperNumber = selectedQuestions.findIndex((item) => item.question_id === question.question_id) + 1;
                    return <article key={question.question_id}>
                      <span className="question-number">{paperNumber}</span>
                      <div className="arrangement-question"><strong>{question.snapshot.stem_text}</strong><div><span>{question.snapshot.subject_name || subjects.find((subject) => subject.id === question.snapshot.subject_id)?.name || 'Subject'}</span><span>{question.snapshot.chapter_name || 'No chapter'}</span><span>{readable(question.snapshot.difficulty)}</span><span>{readable(question.generation_source || 'manual')}</span>{question.usage_count !== undefined && <span>Used {question.usage_count}×</span>}</div><select className="rm-input" value={question.section_client_id} onChange={(event) => updateSelected(question.question_id, { section_client_id: event.target.value })}>{sections.map((option) => <option key={option.client_id} value={option.client_id}>{option.title}</option>)}</select><div className="marks-row"><label>Marks<input type="number" step="0.25" className="rm-input" value={question.marks} onChange={(event) => updateSelected(question.question_id, { marks: Number(event.target.value) })} /></label><label>Negative<input type="number" step="0.25" className="rm-input" value={question.negative_marks} onChange={(event) => updateSelected(question.question_id, { negative_marks: Number(event.target.value) })} /></label><label className="check-inline"><input type="checkbox" checked={Boolean(question.is_mandatory)} onChange={(event) => updateSelected(question.question_id, { is_mandatory: event.target.checked })} /> Mandatory</label></div></div>
                      <div className="arrangement-actions"><button title="Move to top" disabled={question.position_locked} onClick={() => moveQuestion(question.question_id, 'top')}><ChevronLeft size={15} className="rotate-90" /></button><button title="Move up" disabled={question.position_locked} onClick={() => moveQuestion(question.question_id, 'up')}><ArrowUp size={15} /></button><button title="Move down" disabled={question.position_locked} onClick={() => moveQuestion(question.question_id, 'down')}><ArrowDown size={15} /></button><button title="Move to bottom" disabled={question.position_locked} onClick={() => moveQuestion(question.question_id, 'bottom')}><ChevronRight size={15} className="rotate-90" /></button><button title={question.is_locked ? 'Unlock question' : 'Lock question'} onClick={() => updateSelected(question.question_id, { is_locked: !question.is_locked })}>{question.is_locked ? <Lock size={15} /> : <Unlock size={15} />}</button><button title="Lock position" onClick={() => updateSelected(question.question_id, { position_locked: !question.position_locked })} className={question.position_locked ? 'active' : ''}><GripVertical size={15} /></button><button title="Remove question" onClick={() => removeQuestion(question.question_id)} className="danger"><Trash2 size={15} /></button></div>
                    </article>;
                  })}</div>;
                })}
              </div>}
            </section>
          )}

          {activeStep === "rules" && (
            <section>
              <div className="v8-step-heading"><div><span className="rm-label">Step 6</span><h1>Marks and paper rules</h1><p>Configure reusable paper-definition rules. The student timer and delivery engine are not built here.</p></div></div>
              <div className="v8-rules-grid">
                <article><h2><Clock3 size={18} /> Duration</h2><div className="v8-form-grid three"><label><span>Paper duration</span><input type="number" min={1} className="rm-input" value={durationMinutes} onChange={(event) => updateField(setDurationMinutes, Number(event.target.value))} /></label><label><span>Reading time</span><input type="number" min={0} className="rm-input" value={readingTimeMinutes} onChange={(event) => updateField(setReadingTimeMinutes, Number(event.target.value))} /></label><label><span>Grace time</span><input type="number" min={0} className="rm-input" value={graceTimeMinutes} onChange={(event) => updateField(setGraceTimeMinutes, Number(event.target.value))} /></label><label className="checkbox-label"><input type="checkbox" checked={autoSubmit} onChange={(event) => updateField(setAutoSubmit, event.target.checked)} /> Store auto-submit rule</label></div><div className={`duration-advice ${estimatedMinutes > durationMinutes + readingTimeMinutes + graceTimeMinutes ? 'warning' : ''}`}><Clock3 size={17} /><span>Estimated question time: <strong>{estimatedMinutes} minutes</strong> · Configured total: <strong>{durationMinutes + readingTimeMinutes + graceTimeMinutes} minutes</strong></span></div></article>
                <article><h2><Settings2 size={18} /> Marking</h2><div className="v8-form-grid three"><label><span>Default positive marks</span><input type="number" step="0.25" className="rm-input" value={defaultPositiveMarks ?? ""} onChange={(event) => updateField(setDefaultPositiveMarks, event.target.value ? Number(event.target.value) : undefined)} /></label><label><span>Default negative marks</span><input type="number" step="0.25" className="rm-input" value={defaultNegativeMarks ?? ""} onChange={(event) => updateField(setDefaultNegativeMarks, event.target.value ? Number(event.target.value) : undefined)} /></label><label><span>Unanswered marks</span><input type="number" step="0.25" className="rm-input" value={unansweredMarks} onChange={(event) => updateField(setUnansweredMarks, Number(event.target.value))} /></label><label><span>Numerical tolerance</span><input type="number" step="0.000001" className="rm-input" value={numericalTolerance ?? ""} onChange={(event) => updateField(setNumericalTolerance, event.target.value ? Number(event.target.value) : undefined)} /></label><label className="checkbox-label"><input type="checkbox" checked={allowPartialMarking} onChange={(event) => updateField(setAllowPartialMarking, event.target.checked)} /> Allow partial marking</label></div></article>
                <article><h2><RefreshCw size={18} /> Question use</h2><div className="rules-options"><label><input type="checkbox" checked={allowPreviouslyUsed} onChange={(event) => { updateField(setAllowPreviouslyUsed, event.target.checked); if (!event.target.checked) updateField(setOnlyUnused, true); }} /> Allow previously used questions</label><label><input type="checkbox" checked={preferUnused} onChange={(event) => { updateField(setPreferUnused, event.target.checked); if (event.target.checked) updateField(setOnlyUnused, false); }} /> Prefer unused questions</label><label><input type="checkbox" checked={onlyUnused} onChange={(event) => { updateField(setOnlyUnused, event.target.checked); if (event.target.checked) { updateField(setPreferUnused, false); updateField(setAllowPreviouslyUsed, false); } }} /> Use only unused questions</label></div><div className="v8-form-grid two"><label><span>Exclude used within X days</span><input type="number" min={0} className="rm-input" value={excludeUsedWithinDays ?? ""} onChange={(event) => updateField(setExcludeUsedWithinDays, event.target.value ? Number(event.target.value) : undefined)} /></label><label><span>Exclude used more than X times</span><input type="number" min={0} className="rm-input" value={excludeUsedMoreThan ?? ""} onChange={(event) => updateField(setExcludeUsedMoreThan, event.target.value ? Number(event.target.value) : undefined)} /></label></div></article>
                <article><h2><Sparkles size={18} /> Shuffle definition</h2><div className="v8-form-grid two"><label><span>Question order rule</span><select className="rm-input" value={shuffleMode} onChange={(event) => updateField(setShuffleMode, event.target.value as typeof shuffleMode)}><option value="fixed">Keep fixed order</option><option value="all">Shuffle all questions</option><option value="within_sections">Shuffle inside each section</option><option value="sections">Shuffle section order</option></select></label><label className="checkbox-label"><input type="checkbox" checked={shuffleQuestions} onChange={(event) => updateField(setShuffleQuestions, event.target.checked)} /> Enable question shuffling</label><label className="checkbox-label"><input type="checkbox" checked={shuffleOptions} onChange={(event) => updateField(setShuffleOptions, event.target.checked)} /> Shuffle answer options</label><label className="checkbox-label"><input type="checkbox" checked={preserveLockedPositions} onChange={(event) => updateField(setPreserveLockedPositions, event.target.checked)} /> Preserve locked positions</label></div></article>
              </div>
            </section>
          )}

          {activeStep === "preview" && (
            <section>
              <div className="v8-step-heading split"><div><span className="rm-label">Step 7</span><h1>Preview and validation</h1><p>Inspect the complete paper definition before submitting it for academic review.</p></div><div className="preview-actions"><button className="rm-btn-secondary" onClick={() => void runValidation()} disabled={validating}>{validating ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />} Validate</button><button className="rm-btn-primary" onClick={() => void submitForReview()} disabled={submittingReview}>{submittingReview ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} Submit for review</button></div></div>
              <div className="v8-preview-summary"><div><strong>{selectedQuestions.length}</strong><span>Total questions</span></div><div><strong>{requiredAttempts}</strong><span>Required attempts</span></div><div><strong>{sections.length}</strong><span>Sections</span></div><div><strong>{totalMarks}</strong><span>Maximum marks</span></div><div><strong>{durationMinutes} min</strong><span>Duration</span></div><div><strong>{estimatedMinutes} min</strong><span>Estimated solving</span></div></div>
              {validation && <div className={`v8-validation ${validation.valid ? 'valid' : 'invalid'}`}><div className="validation-heading">{validation.valid ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}<div><strong>{validation.valid ? 'No critical errors' : `${validation.critical.length} critical issue${validation.critical.length === 1 ? '' : 's'}`}</strong><span>{validation.warnings.length} warning{validation.warnings.length === 1 ? '' : 's'}</span></div></div>{validation.critical.length > 0 && <div><h3>Must be fixed</h3>{validation.critical.map((issue) => <button type="button" key={issue.code} onClick={() => setActiveStep(issue.code.includes('programme') || issue.code.includes('subject') ? 'programme' : issue.code.includes('section') ? 'sections' : issue.code.includes('question') || issue.code.includes('answer') ? 'questions' : issue.code.includes('duration') ? 'rules' : 'details')}><AlertCircle size={15} /><span>{issue.message}</span><ChevronRight size={15} /></button>)}</div>}{validation.warnings.length > 0 && <div><h3>Review warnings</h3>{validation.warnings.map((issue) => <p key={issue.code}><AlertCircle size={14} /> {issue.message}</p>)}</div>}</div>}
              <article className="v8-paper-preview"><header><div><span>{code || 'Draft code pending'}</span><h1>{title || 'Untitled paper'}</h1><p>{selectedProgramme?.name || 'Programme not selected'} · {selectedSubjectIds.map((id) => subjects.find((subject) => subject.id === id)?.name).filter(Boolean).join(', ') || 'No subjects selected'}</p></div><div><strong>{durationMinutes} minutes</strong><strong>{totalMarks} marks</strong></div></header>{instructions && <div className="preview-instructions"><strong>Instructions</strong><p>{instructions}</p></div>}{sections.map((section) => { const items = selectedQuestions.filter((question) => question.section_client_id === section.client_id); return <section key={section.client_id}><div className="preview-section-heading"><div><h2>{section.title}</h2><p>{section.instructions}</p></div><span>{items.length} questions</span></div>{items.map((question) => { const number = selectedQuestions.findIndex((item) => item.question_id === question.question_id) + 1; return <article key={question.question_id}><strong className="preview-number">{number}.</strong><div><p>{question.snapshot.stem_text}</p>{question.snapshot.question_image_url && <img src={question.snapshot.question_image_url} alt="Question illustration" />}{question.snapshot.options?.map((option) => <div className="preview-option" key={option.option_key}><strong>{option.option_key}</strong><span>{option.content_text || option.content_latex}</span></div>)}</div><span className="preview-marks">+{question.marks} / −{question.negative_marks}</span></article>; })}</section>; })}</article>
            </section>
          )}
        </main>

        <aside className="v8-summary rm-card">
          <span className="rm-label">Live paper summary</span>
          <h2>{title || "Untitled paper"}</h2>
          <dl>
            <div><dt>Programme</dt><dd>{selectedProgramme?.name || "Not selected"}</dd></div>
            <div><dt>Subjects</dt><dd>{selectedSubjectIds.length}</dd></div>
            <div><dt>Sections</dt><dd>{sections.length}</dd></div>
            <div><dt>Questions</dt><dd>{selectedQuestions.length}</dd></div>
            <div><dt>Required attempts</dt><dd>{requiredAttempts}</dd></div>
            <div><dt>Maximum marks</dt><dd>{totalMarks}</dd></div>
            <div><dt>Duration</dt><dd>{durationMinutes} min</dd></div>
            <div><dt>Estimated solving</dt><dd>{estimatedMinutes} min</dd></div>
            <div><dt>Draft revision</dt><dd>{revision}</dd></div>
          </dl>
          <div className="v8-distribution"><strong>Subject distribution</strong>{selectedSubjectIds.length === 0 ? <p>No subjects selected</p> : selectedSubjectIds.map((subjectId) => { const subject = subjects.find((value) => value.id === subjectId); const count = selectedQuestions.filter((question) => question.snapshot.subject_id === subjectId).length; return <div key={subjectId}><span>{subject?.name || 'Subject'}</span><strong>{count}</strong></div>; })}</div>
          <div className="v8-scope-note"><ShieldCheck size={17} /><p>This workspace creates paper definitions only. Products, pricing, payment, entitlement and test delivery remain separate.</p></div>
        </aside>
      </div>

      <footer className="v8-builder-footer">
        <button className="rm-btn-secondary" disabled={steps.findIndex((step) => step.key === activeStep) === 0} onClick={() => { const index = steps.findIndex((step) => step.key === activeStep); setActiveStep(steps[Math.max(0, index - 1)].key); }}><ChevronLeft size={16} /> Previous</button>
        <span>Step {steps.findIndex((step) => step.key === activeStep) + 1} of {steps.length}</span>
        <button className="rm-btn-primary" disabled={steps.findIndex((step) => step.key === activeStep) === steps.length - 1} onClick={() => { const index = steps.findIndex((step) => step.key === activeStep); setActiveStep(steps[Math.min(steps.length - 1, index + 1)].key); }}>Next <ChevronRight size={16} /></button>
      </footer>

      <style>{`
        .v8-paper-builder{color:#14232B}.v8-paper-header{position:sticky;top:0;z-index:25;padding:14px 16px;display:flex;justify-content:space-between;gap:16px;align-items:center}.v8-paper-title{display:flex;gap:16px;align-items:center;min-width:0}.v8-back-link{display:inline-flex;gap:6px;align-items:center;color:#667085;font-size:13px;font-weight:750;white-space:nowrap}.v8-title-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.v8-title-row>strong{font-size:18px}.v8-header-meta{font-size:12px;color:#667085;margin-top:4px}.v8-save-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.v8-save-state{display:flex;gap:5px;align-items:center;padding:7px 9px;border-radius:10px;background:#F7F9F7;color:#667085;font-size:12px}.v8-save-state.saved{color:#137A3A;background:#ECFDF3}.v8-save-state.failed{color:#B42318;background:#FEF3F2}.v8-save-state small{color:inherit;opacity:.75}.v8-message{margin-top:12px;padding:12px 14px;border-radius:12px;font-weight:650}.v8-message.error{background:#FEF3F2;color:#B42318}.v8-message.success{background:#ECFDF3;color:#137A3A}.v8-builder-layout{display:grid;grid-template-columns:190px minmax(0,1fr) 260px;gap:14px;margin-top:14px;align-items:start}.v8-step-nav{position:sticky;top:92px;padding:8px;display:grid;gap:4px}.v8-step-nav button{border:0;background:transparent;border-radius:10px;padding:10px;display:grid;grid-template-columns:24px 20px 1fr;align-items:center;gap:7px;text-align:left;color:#667085;font-weight:700}.v8-step-nav button>span{width:22px;height:22px;border-radius:7px;background:#F2F4F7;display:grid;place-items:center;font-size:11px}.v8-step-nav button.active{background:#EAF4F2;color:#0E5A5A}.v8-step-nav button.active>span{background:#0E5A5A;color:white}.v8-workspace{padding:20px;min-width:0}.v8-step-heading{display:flex;justify-content:space-between;gap:15px;align-items:start;margin-bottom:18px}.v8-step-heading.split{align-items:center}.v8-step-heading h1{font-size:25px;margin:4px 0}.v8-step-heading p{color:#667085;margin:0;line-height:1.55}.v8-form-grid{display:grid;gap:14px}.v8-form-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.v8-form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.v8-form-grid label{display:grid;gap:6px;font-size:12px;color:#667085;font-weight:650}.v8-form-grid label>span{color:#344054}.wide-two{grid-column:span 2}.wide-three{grid-column:1/-1}.checkbox-label{display:flex!important;align-items:center;gap:8px!important;align-self:end;padding:10px 0;color:#344054!important}.v8-programme-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.v8-programme-grid button{border:1px solid #E4E7EC;background:white;border-radius:13px;padding:14px;text-align:left;display:grid;gap:5px;position:relative}.v8-programme-grid button span{font-size:11px;color:#667085;text-transform:capitalize}.v8-programme-grid button svg{position:absolute;right:12px;top:12px;color:#0E5A5A}.v8-programme-grid button.selected{border:2px solid #0E5A5A;background:#EAF4F2}.v8-subject-panel{margin-top:18px;border-top:1px solid #E7ECEB;padding-top:18px}.v8-subject-panel h2{margin:4px 0 12px}.v8-subject-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.v8-subject-grid button{border:1px solid #E4E7EC;background:white;border-radius:12px;padding:11px;display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:8px;text-align:left}.v8-subject-grid button>span{width:26px;height:26px;border-radius:8px;background:#F2F4F7;display:grid;place-items:center}.v8-subject-grid button small{color:#98A2B3}.v8-subject-grid button.selected{border-color:#0E5A5A;background:#EAF4F2}.v8-subject-grid button.selected>span{background:#0E5A5A;color:white}.v8-mode-select{display:grid;gap:6px;max-width:360px;margin-top:18px;font-size:12px;font-weight:650}.v8-section-list{display:grid;gap:12px}.v8-section-list>article{border:1px solid #E4E7EC;border-radius:14px;padding:14px}.v8-section-list>article.active{border:2px solid #F2B84B;background:#FFFDF7}.v8-section-toolbar{display:grid;grid-template-columns:34px 1fr auto auto;align-items:center;gap:8px;margin-bottom:12px}.section-index{width:30px;height:30px;border:0;border-radius:9px;background:#14232B;color:white;font-weight:800}.v8-section-toolbar>span{font-size:12px;color:#667085}.v8-section-toolbar>div{display:flex;gap:5px}.v8-section-toolbar>div button,.arrangement-actions button{border:1px solid #E4E7EC;background:white;border-radius:8px;padding:6px;display:grid;place-items:center}.v8-section-toolbar>div button:last-child,.arrangement-actions button.danger{color:#B42318}.v8-active-section{display:grid;gap:4px;font-size:11px;color:#667085;min-width:220px}.v8-availability{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px}.v8-availability>div{border:1px solid #E7ECEB;border-radius:11px;padding:10px;background:#F7F9F7}.v8-availability strong{display:block;font-size:20px}.v8-availability span{font-size:11px;color:#667085}.availability-status{display:flex!important;gap:7px;align-items:center;background:#ECFDF3!important;color:#137A3A}.availability-status strong{font-size:13px!important}.availability-status.no_questions{background:#FEF3F2!important;color:#B42318}.v8-bank-filters{display:grid;grid-template-columns:minmax(240px,1fr) repeat(5,minmax(125px,170px));gap:8px}.search-field{position:relative}.search-field svg{position:absolute;left:11px;top:12px;color:#98A2B3}.search-field input{padding-left:35px}.v8-bank-bulkbar{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid #E7ECEB}.v8-bank-bulkbar label{display:flex;gap:7px;align-items:center;font-size:13px;font-weight:650}.v8-bank-bulkbar>span{color:#667085;font-size:12px}.v8-question-bank{display:grid;gap:9px;margin-top:10px}.v8-question-bank>article{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:10px;border:1px solid #E4E7EC;border-radius:13px;padding:12px}.v8-question-bank>article.included{background:#F7F9F7}.question-check{padding-top:3px}.question-body>strong{display:block;line-height:1.5}.question-labels,.question-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px}.question-labels span{background:#F2F4F7;border-radius:999px;padding:3px 7px;font-size:10px;color:#475467}.question-meta{margin-top:8px;margin-bottom:0;color:#667085;font-size:11px}.question-meta span+span:before{content:'•';margin-right:6px}.question-body img{max-width:220px;max-height:130px;object-fit:contain;margin-top:8px;border-radius:8px}.v8-pagination{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;font-size:12px;color:#667085}.v8-pagination button{display:inline-flex;gap:5px;align-items:center;border:1px solid #E4E7EC;background:white;border-radius:9px;padding:8px 10px}.v8-pagination button:disabled{opacity:.45}.v8-empty{padding:42px;text-align:center;color:#667085;border:1px dashed #D0D5DD;border-radius:13px}.v8-arrangement-list{display:grid;gap:14px}.arrangement-section{border:1px solid #E4E7EC;border-radius:14px;overflow:hidden}.arrangement-heading{display:flex;justify-content:space-between;padding:12px 14px;background:#F7F9F7}.arrangement-heading>div{display:flex;gap:8px;align-items:center}.arrangement-heading span{color:#667085;font-size:12px}.arrangement-section>article{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;padding:12px;border-top:1px solid #E7ECEB}.question-number{width:32px;height:32px;border-radius:9px;background:#14232B;color:white;display:grid;place-items:center;font-weight:800}.arrangement-question>strong{line-height:1.45}.arrangement-question>div{display:flex;gap:6px;flex-wrap:wrap;margin:7px 0}.arrangement-question>div span{font-size:10px;background:#F2F4F7;border-radius:999px;padding:3px 7px;color:#667085}.arrangement-question>select{max-width:260px}.marks-row{display:grid!important;grid-template-columns:100px 100px 1fr;align-items:end}.marks-row label{display:grid;gap:3px;font-size:10px;color:#667085}.marks-row .check-inline{display:flex;align-items:center;gap:6px;padding-bottom:8px}.arrangement-actions{display:grid;grid-template-columns:repeat(2,32px);gap:5px;align-content:start}.arrangement-actions button.active{background:#EAF4F2;color:#0E5A5A;border-color:#0E5A5A}.arrangement-actions button:disabled{opacity:.35}.arrangement-empty{padding:16px;color:#98A2B3}.rotate-90{transform:rotate(90deg)}.v8-rules-grid{display:grid;gap:14px}.v8-rules-grid>article{border:1px solid #E4E7EC;border-radius:14px;padding:15px}.v8-rules-grid h2{display:flex;gap:7px;align-items:center;font-size:17px;margin:0 0 12px}.duration-advice{display:flex;gap:8px;align-items:center;margin-top:12px;padding:10px;border-radius:10px;background:#ECFDF3;color:#137A3A;font-size:12px}.duration-advice.warning{background:#FFF8E6;color:#8A5F00}.rules-options{display:flex;gap:15px;flex-wrap:wrap;margin-bottom:12px}.rules-options label{display:flex;gap:7px;align-items:center;font-size:13px}.preview-actions{display:flex;gap:8px;flex-wrap:wrap}.v8-preview-summary{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:14px}.v8-preview-summary>div{border:1px solid #E7ECEB;border-radius:11px;padding:10px;background:#F7F9F7}.v8-preview-summary strong{display:block;font-size:19px}.v8-preview-summary span{font-size:10px;color:#667085}.v8-validation{border:1px solid #F2B84B;border-radius:13px;padding:13px;margin-bottom:14px;background:#FFFDF7}.v8-validation.valid{border-color:#A6D8C8;background:#ECFDF3}.validation-heading{display:flex;gap:9px;align-items:center}.validation-heading>div{display:grid}.validation-heading span{font-size:11px;color:#667085}.v8-validation h3{font-size:13px;margin:12px 0 6px}.v8-validation button{width:100%;border:0;background:white;border-radius:9px;padding:9px;display:grid;grid-template-columns:18px 1fr 18px;gap:7px;text-align:left;margin-top:5px;color:#B42318}.v8-validation p{display:flex;gap:6px;align-items:start;font-size:12px;color:#8A5F00}.v8-paper-preview{border:1px solid #D0D5DD;border-radius:14px;padding:22px;background:white}.v8-paper-preview>header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #14232B;padding-bottom:14px}.v8-paper-preview>header span{font-size:11px;color:#667085}.v8-paper-preview>header h1{margin:4px 0;font-size:24px}.v8-paper-preview>header p{margin:0;color:#667085}.v8-paper-preview>header>div:last-child{display:grid;text-align:right;align-content:start}.preview-instructions{margin-top:14px;padding:12px;border-left:4px solid #F2B84B;background:#FFFDF7}.preview-instructions p{white-space:pre-wrap;margin:6px 0 0}.v8-paper-preview>section{margin-top:20px}.preview-section-heading{display:flex;justify-content:space-between;gap:15px;padding:10px 0;border-bottom:1px solid #D0D5DD}.preview-section-heading h2{margin:0}.preview-section-heading p{margin:3px 0 0;color:#667085;font-size:12px}.v8-paper-preview>section>article{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;padding:14px 0;border-bottom:1px solid #EAECF0}.v8-paper-preview>section>article p{margin:0;line-height:1.6}.v8-paper-preview>section>article img{max-width:320px;max-height:220px;object-fit:contain;margin-top:8px}.preview-option{display:grid;grid-template-columns:25px 1fr;gap:7px;margin-top:7px}.preview-marks{font-size:11px;color:#8A5F00;white-space:nowrap}.v8-summary{position:sticky;top:92px;padding:15px}.v8-summary h2{font-size:18px;margin:6px 0 12px}.v8-summary dl{display:grid;gap:0;margin:0}.v8-summary dl>div{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #EAECF0}.v8-summary dt{color:#667085;font-size:12px}.v8-summary dd{margin:0;font-size:12px;font-weight:750;text-align:right}.v8-distribution{margin-top:14px}.v8-distribution>strong{font-size:12px}.v8-distribution>div{display:flex;justify-content:space-between;padding:6px 0;font-size:11px;color:#667085}.v8-distribution p{font-size:11px;color:#98A2B3}.v8-scope-note{display:flex;gap:8px;align-items:start;margin-top:14px;padding:10px;border-radius:10px;background:#EAF4F2;color:#0E5A5A}.v8-scope-note p{font-size:11px;line-height:1.45;margin:0}.v8-builder-footer{position:sticky;bottom:10px;z-index:20;margin:14px 0 0 204px;width:calc(100% - 478px);display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.96);box-shadow:0 8px 28px rgba(19,30,53,.16);backdrop-filter:blur(8px)}.v8-builder-footer>span{font-size:12px;color:#667085}
        @media(max-width:1280px){.v8-builder-layout{grid-template-columns:170px minmax(0,1fr)}.v8-summary{position:relative;top:0;grid-column:2}.v8-builder-footer{margin-left:184px;width:calc(100% - 184px)}.v8-bank-filters{grid-template-columns:1fr 1fr 1fr}}
        @media(max-width:850px){.v8-paper-header{position:relative;align-items:flex-start}.v8-paper-title,.v8-paper-header{display:grid}.v8-builder-layout{grid-template-columns:1fr}.v8-step-nav{position:relative;top:0;grid-template-columns:repeat(4,1fr)}.v8-step-nav button{grid-template-columns:22px 18px 1fr}.v8-summary{grid-column:1}.v8-builder-footer{margin-left:0;width:100%}.v8-form-grid.three,.v8-programme-grid,.v8-subject-grid,.v8-preview-summary{grid-template-columns:1fr 1fr}.wide-two{grid-column:span 1}.v8-availability{grid-template-columns:1fr 1fr}.v8-bank-filters{grid-template-columns:1fr 1fr}}
        @media(max-width:560px){.v8-save-actions{display:grid;width:100%}.v8-step-nav{grid-template-columns:1fr 1fr}.v8-step-nav button{grid-template-columns:22px 18px 1fr}.v8-workspace{padding:14px}.v8-form-grid.three,.v8-form-grid.two,.v8-programme-grid,.v8-subject-grid,.v8-preview-summary,.v8-bank-filters,.v8-availability{grid-template-columns:1fr}.v8-section-toolbar{grid-template-columns:34px 1fr}.v8-section-toolbar>span,.v8-section-toolbar>div{grid-column:2}.v8-question-bank>article{grid-template-columns:24px minmax(0,1fr)}.v8-question-bank>article>button{grid-column:2}.arrangement-section>article{grid-template-columns:34px minmax(0,1fr)}.arrangement-actions{grid-column:2;grid-template-columns:repeat(7,32px)}.marks-row{grid-template-columns:1fr 1fr!important}.marks-row .check-inline{grid-column:1/-1}.v8-paper-preview{padding:14px}.v8-paper-preview>header{display:grid}.v8-paper-preview>header>div:last-child{text-align:left}.v8-builder-footer{bottom:4px}.v8-builder-footer>span{display:none}}
      `}</style>
    </div>
  );
}
