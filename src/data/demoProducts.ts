import { StoreProduct } from "@/types/commerce";

export const demoProducts: StoreProduct[] = [
  {
    id: "demo-neet", name: "NEET Complete Test Series", slug: "neet-complete-test-series",
    short_description: "Full-syllabus NEET mock tests with performance analysis.", description: null,
    product_type: "test_series", audience: "student", exam_type: "NEET", cover_image_url: null,
    is_featured: true, version_id: "demo-neet-v1", mrp_paise: 599900, selling_price_paise: 199900,
    access_days: 365, max_attempts: 20, student_limit: null,
    features: ["20 full-length tests", "Subject and chapter analysis", "Attempt history", "Mobile access"],
    starts_at: null, ends_at: null,
  },
  {
    id: "demo-jee", name: "JEE Main Practice Series", slug: "jee-main-practice-series",
    short_description: "Timed JEE Main tests across Physics, Chemistry and Mathematics.", description: null,
    product_type: "test_series", audience: "student", exam_type: "JEE Main", cover_image_url: null,
    is_featured: false, version_id: "demo-jee-v1", mrp_paise: 399900, selling_price_paise: 149900,
    access_days: 180, max_attempts: 15, student_limit: null,
    features: ["15 JEE Main tests", "PCM analytics", "Rank and percentile-ready", "Mobile access"],
    starts_at: null, ends_at: null,
  },
  {
    id: "demo-school", name: "School Starter Plan", slug: "school-starter-plan",
    short_description: "Run tests for up to 100 students.", description: null,
    product_type: "school_subscription", audience: "school", exam_type: null, cover_image_url: null,
    is_featured: false, version_id: "demo-school-v1", mrp_paise: 999900, selling_price_paise: 599900,
    access_days: 365, max_attempts: null, student_limit: 100,
    features: ["Up to 100 students", "2 staff accounts", "Private question bank", "20 examinations"],
    starts_at: null, ends_at: null,
  },
];
