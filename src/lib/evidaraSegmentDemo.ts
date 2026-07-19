import type { SegmentEvidence } from "@/lib/evidaraSegments";

export type SegmentStudentRecord = {
  id: string;
  name: string;
  grade: number;
  section: string;
  subjectFocus: string;
  evidence: SegmentEvidence;
};

export const segmentStudentRecords: SegmentStudentRecord[] = [
  { id:"st-001", name:"Ananya Rao", grade:10, section:"A", subjectFocus:"Science", evidence:{assessmentCount:5,percentile:91,accuracy:84,scoreChange:26,avoidableLossShare:24,responseTimeRatio:1.08,evidenceWindow:"Five comparable assessments · 12 May–14 July",calculatedAt:"19 Jul 2026, 3:20 PM"}},
  { id:"st-002", name:"Arjun Nair", grade:10, section:"A", subjectFocus:"Mathematics", evidence:{assessmentCount:4,percentile:97,accuracy:92,scoreChange:6,avoidableLossShare:8,responseTimeRatio:.96,evidenceWindow:"Four comparable assessments · 20 May–16 July",calculatedAt:"19 Jul 2026, 3:20 PM"}},
  { id:"st-003", name:"Meera Iyer", grade:10, section:"B", subjectFocus:"Physics", evidence:{assessmentCount:5,percentile:82,accuracy:86,scoreChange:5,avoidableLossShare:12,responseTimeRatio:1.31,evidenceWindow:"Five comparable assessments · 10 May–15 July",calculatedAt:"19 Jul 2026, 3:20 PM"}},
  { id:"st-004", name:"Kabir Shah", grade:9, section:"A", subjectFocus:"Biology", evidence:{assessmentCount:5,percentile:79,accuracy:73,scoreChange:4,avoidableLossShare:31,responseTimeRatio:1.04,evidenceWindow:"Five comparable assessments · 18 May–17 July",calculatedAt:"19 Jul 2026, 3:20 PM"}},
  { id:"st-005", name:"Sara Joseph", grade:9, section:"B", subjectFocus:"Chemistry", evidence:{assessmentCount:4,percentile:68,accuracy:71,scoreChange:14,avoidableLossShare:16,responseTimeRatio:1.11,evidenceWindow:"Four comparable assessments · 2 Jun–18 July",calculatedAt:"19 Jul 2026, 3:20 PM"}},
  { id:"st-006", name:"Vihaan Patil", grade:8, section:"A", subjectFocus:"Mathematics", evidence:{assessmentCount:3,percentile:62,accuracy:67,scoreChange:5,avoidableLossShare:18,responseTimeRatio:1.09,evidenceWindow:"Three comparable assessments · 15 Jun–17 July",calculatedAt:"19 Jul 2026, 3:20 PM"}},
  { id:"st-007", name:"Diya Menon", grade:8, section:"B", subjectFocus:"Science", evidence:{assessmentCount:2,percentile:null,accuracy:76,scoreChange:null,avoidableLossShare:null,responseTimeRatio:1.02,evidenceWindow:"Two comparable assessments · 28 Jun–16 July",calculatedAt:"19 Jul 2026, 3:20 PM"}},
  { id:"st-008", name:"Reyansh Kumar", grade:10, section:"B", subjectFocus:"Mathematics", evidence:{assessmentCount:5,percentile:72,accuracy:69,scoreChange:3,avoidableLossShare:17,responseTimeRatio:1.13,evidenceWindow:"Five comparable assessments · 8 May–14 July",calculatedAt:"19 Jul 2026, 3:20 PM"}},
];
