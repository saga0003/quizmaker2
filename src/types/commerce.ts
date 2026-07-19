export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  product_type: string;
  audience: "student" | "school" | "both";
  exam_type: string | null;
  cover_image_url: string | null;
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
};

export function rupees(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

export function discountPercent(mrp: number, selling: number) {
  if (!mrp || selling >= mrp) return 0;
  return Math.round(((mrp - selling) / mrp) * 100);
}
