export const BENCHMARK_PRIVACY_MINIMUM = 20;
export const BENCHMARK_SMALL_CELL_MINIMUM = 10;

export type BenchmarkBand = {
  label: string;
  minimum: number;
  maximum: number;
  networkCount: number;
  schoolCount: number;
};

export type BenchmarkSubject = {
  subject: string;
  schoolAverage: number;
  networkAverage: number;
  schoolAccuracy: number;
  networkAccuracy: number;
};

export type BenchmarkStudent = {
  id: string;
  name: string;
  score: number;
  percentage: number;
  networkPercentile: number | null;
  status: "Submitted" | "In progress" | "Not started";
};

export type BenchmarkPublication = {
  id: string;
  title: string;
  paperVersion: string;
  fingerprint: string;
  grade: string;
  track: string;
  window: string;
  accessCode: string;
  shareStatus: "Published" | "Draft" | "Closed";
  validAttempts: number;
  participatingSchools: number;
  schoolAttempts: number;
  minimumSample: number;
  schoolAverage: number | null;
  networkAverage: number | null;
  schoolMedian: number | null;
  networkMedian: number | null;
  schoolPercentile: number | null;
  topQuartileCutoff: number | null;
  privacyReady: boolean;
  bands: BenchmarkBand[];
  subjects: BenchmarkSubject[];
  students: BenchmarkStudent[];
};

export const benchmarkPublications: BenchmarkPublication[] = [
  {
    id: "bm-science-10-v1",
    title: "Grade 10 Science Common Assessment",
    paperVersion: "Version 1.0 · 80 marks · 90 minutes",
    fingerprint: "EV-SCI10-2607-A91F",
    grade: "Grade 10",
    track: "State Board · Science",
    window: "12–18 July 2026",
    accessCode: "EVI-SCI-2607",
    shareStatus: "Published",
    validAttempts: 2486,
    participatingSchools: 38,
    schoolAttempts: 62,
    minimumSample: BENCHMARK_PRIVACY_MINIMUM,
    schoolAverage: 68.4,
    networkAverage: 61.7,
    schoolMedian: 69,
    networkMedian: 62,
    schoolPercentile: 71,
    topQuartileCutoff: 74,
    privacyReady: true,
    bands: [
      { label: "0–39%", minimum: 0, maximum: 39, networkCount: 298, schoolCount: 3 },
      { label: "40–59%", minimum: 40, maximum: 59, networkCount: 771, schoolCount: 12 },
      { label: "60–74%", minimum: 60, maximum: 74, networkCount: 879, schoolCount: 26 },
      { label: "75–89%", minimum: 75, maximum: 89, networkCount: 451, schoolCount: 17 },
      { label: "90–100%", minimum: 90, maximum: 100, networkCount: 87, schoolCount: 4 },
    ],
    subjects: [
      { subject: "Physics", schoolAverage: 72, networkAverage: 63, schoolAccuracy: 78, networkAccuracy: 69 },
      { subject: "Chemistry", schoolAverage: 65, networkAverage: 61, schoolAccuracy: 71, networkAccuracy: 66 },
      { subject: "Biology", schoolAverage: 69, networkAverage: 62, schoolAccuracy: 76, networkAccuracy: 68 },
    ],
    students: [
      { id: "st-001", name: "Ananya Rao", score: 73, percentage: 91.3, networkPercentile: 97, status: "Submitted" },
      { id: "st-002", name: "Arjun Nair", score: 68, percentage: 85, networkPercentile: 91, status: "Submitted" },
      { id: "st-003", name: "Meera Iyer", score: 61, percentage: 76.3, networkPercentile: 79, status: "Submitted" },
      { id: "st-004", name: "Kabir Shah", score: 54, percentage: 67.5, networkPercentile: 64, status: "Submitted" },
      { id: "st-005", name: "Sara Joseph", score: 48, percentage: 60, networkPercentile: 49, status: "Submitted" },
      { id: "st-006", name: "Vihaan Patil", score: 0, percentage: 0, networkPercentile: null, status: "In progress" },
    ],
  },
  {
    id: "bm-kcet-physics-v2",
    title: "KCET Physics Diagnostic",
    paperVersion: "Version 2.1 · 60 marks · 80 minutes",
    fingerprint: "EV-KCET-PHY-2607-B44D",
    grade: "Grade 12",
    track: "KCET · Physics",
    window: "16–22 July 2026",
    accessCode: "EVI-KPHY-2607",
    shareStatus: "Published",
    validAttempts: 17,
    participatingSchools: 4,
    schoolAttempts: 8,
    minimumSample: BENCHMARK_PRIVACY_MINIMUM,
    schoolAverage: 56.8,
    networkAverage: null,
    schoolMedian: 57,
    networkMedian: null,
    schoolPercentile: null,
    topQuartileCutoff: null,
    privacyReady: false,
    bands: [],
    subjects: [],
    students: [
      { id: "st-101", name: "Nisha Gowda", score: 39, percentage: 65, networkPercentile: null, status: "Submitted" },
      { id: "st-102", name: "Rahul K", score: 31, percentage: 51.7, networkPercentile: null, status: "Submitted" },
    ],
  },
  {
    id: "bm-maths-10-v3",
    title: "Grade 10 Mathematics Common Paper",
    paperVersion: "Version 3.0 · 100 marks · 120 minutes",
    fingerprint: "EV-MATH10-2606-C22A",
    grade: "Grade 10",
    track: "State Board · Mathematics",
    window: "20–28 June 2026",
    accessCode: "EVI-MATH-2606",
    shareStatus: "Closed",
    validAttempts: 842,
    participatingSchools: 19,
    schoolAttempts: 58,
    minimumSample: BENCHMARK_PRIVACY_MINIMUM,
    schoolAverage: 74.1,
    networkAverage: 67.3,
    schoolMedian: 76,
    networkMedian: 69,
    schoolPercentile: 76,
    topQuartileCutoff: 79,
    privacyReady: true,
    bands: [
      { label: "0–39%", minimum: 0, maximum: 39, networkCount: 61, schoolCount: 1 },
      { label: "40–59%", minimum: 40, maximum: 59, networkCount: 187, schoolCount: 7 },
      { label: "60–74%", minimum: 60, maximum: 74, networkCount: 264, schoolCount: 19 },
      { label: "75–89%", minimum: 75, maximum: 89, networkCount: 271, schoolCount: 24 },
      { label: "90–100%", minimum: 90, maximum: 100, networkCount: 59, schoolCount: 7 },
    ],
    subjects: [
      { subject: "Algebra", schoolAverage: 78, networkAverage: 70, schoolAccuracy: 81, networkAccuracy: 73 },
      { subject: "Geometry", schoolAverage: 70, networkAverage: 65, schoolAccuracy: 74, networkAccuracy: 69 },
      { subject: "Statistics", schoolAverage: 75, networkAverage: 68, schoolAccuracy: 79, networkAccuracy: 72 },
    ],
    students: [],
  },
];

export function benchmarkProgress(publication: BenchmarkPublication) {
  return Math.min(100, Math.round((publication.validAttempts / publication.minimumSample) * 100));
}
