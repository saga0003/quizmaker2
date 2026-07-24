export type ProductAudience = 'student' | 'school' | 'both';
export type ProductStatus = 'draft' | 'published' | 'archived';

export type ProductPaper = {
  id?: string;
  paper_id: string;
  display_name: string;
  display_order: number;
  title?: string;
  code?: string | null;
  exam_type?: string | null;
  grade_level?: string | null;
  test_type?: string | null;
  duration_minutes?: number | null;
  total_questions?: number | null;
  total_marks?: number | null;
  status?: string;
};

export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  product_type: string;
  audience: ProductAudience;
  exam_type: string | null;
  grade_levels: string[];
  cover_image_url: string | null;
  gallery_image_urls: string[];
  image_alt_text: string | null;
  is_featured: boolean;
  version_id: string;
  mrp_paise: number;
  selling_price_paise: number;
  access_days: number | null;
  max_attempts: number | null;
  student_limit: number | null;
  features: string[];
  starts_at: string | null;
  ends_at: string | null;
  paper_count: number;
  papers: ProductPaper[];
};

export type AdminProduct = Omit<StoreProduct, 'version_id' | 'paper_count'> & {
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  paper_count: number;
  current_version: {
    id: string;
    version_number: number;
    mrp_paise: number;
    selling_price_paise: number;
    access_days: number | null;
    max_attempts: number | null;
    student_limit: number | null;
    features: string[];
    starts_at: string | null;
    ends_at: string | null;
  } | null;
};

export type BuilderPaper = {
  id: string;
  title: string;
  code: string | null;
  description: string | null;
  exam_type: string | null;
  grade_level: string | null;
  test_type: string;
  custom_test_type: string | null;
  status: string;
  duration_minutes: number;
  total_questions: number;
  total_marks: number;
  published_at: string | null;
};

export type CommerceAnalytics = {
  from: string;
  to: string;
  granularity: 'day' | 'month' | 'year';
  summary: {
    revenue_paise: number;
    discount_paise: number;
    orders: number;
    student_purchases: number;
    school_purchases: number;
    school_seats_sold: number;
    average_order_paise: number;
    active_products: number;
  };
  series: Array<{
    period: string;
    revenue_paise: number;
    discount_paise: number;
    orders: number;
    students: number;
    schools: number;
    seats: number;
  }>;
  top_products: Array<{
    product_id: string;
    product_name: string;
    revenue_paise: number;
    orders: number;
    students: number;
    schools: number;
    seats: number;
  }>;
  voucher_redemptions: number;
  offline_school_activations: number;
};

export function rupees(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(paise || 0) / 100);
}

export function discountPercent(mrp: number, selling: number) {
  if (!mrp || selling >= mrp) return 0;
  return Math.round(((mrp - selling) / mrp) * 100);
}
