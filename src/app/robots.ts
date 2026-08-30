import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo-public';

/** Public practice/commerce SEO is intentionally parked for the Phase 1 institution launch. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/privacy/', '/terms/', '/refund-policy/', '/contact/'],
      disallow: [
        '/api/', '/admin/', '/student/', '/school/', '/reset-password/',
        '/products/', '/test-series/', '/question-papers/', '/questions/', '/practice/', '/trial/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
