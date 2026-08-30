import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo-public';

/** Phase 1 is institution-first. Public question/product SEO routes remain parked in source. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, priority: 1 },
    { url: `${SITE_URL}/privacy/`, priority: 0.3 },
    { url: `${SITE_URL}/terms/`, priority: 0.3 },
    { url: `${SITE_URL}/contact/`, priority: 0.4 },
  ];
}
