import { MetadataRoute } from 'next';

const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  (process.env.INTERNAL_GATEWAY_URL
    ? `${process.env.INTERNAL_GATEWAY_URL}/api/v1`
    : null) ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://gateway:8080/api/v1';

interface SitemapProduct {
  slug: string;
  updatedAt?: string;
}

interface SitemapCategory {
  slug: string;
  status: string;
}

interface SitemapPost {
  slug: string;
  updatedAt?: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/san-pham`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/kien-thuc`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  let productEntries: MetadataRoute.Sitemap = [];
  let categoryEntries: MetadataRoute.Sitemap = [];
  let postEntries: MetadataRoute.Sitemap = [];

  try {
    const [prodRes, catRes, postRes] = await Promise.all([
      fetch(`${API_BASE_URL}/products?limit=100`, { cache: 'no-store' }),
      fetch(`${API_BASE_URL}/categories`, { cache: 'no-store' }),
      fetch(`${API_BASE_URL}/posts?limit=100`, { cache: 'no-store' }),
    ]);

    if (prodRes.ok) {
      const prodJson = await prodRes.json();
      const items: SitemapProduct[] = prodJson.data?.items || [];
      productEntries = items.map((p) => ({
        url: `${baseUrl}/san-pham/${p.slug}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
    }

    if (catRes.ok) {
      const catJson = await catRes.json();
      const items: SitemapCategory[] = catJson.data || [];
      categoryEntries = items
        .filter((c) => c.status === 'ACTIVE')
        .map((c) => ({
          url: `${baseUrl}/danh-muc/${c.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        }));
    }

    if (postRes.ok) {
      const postJson = await postRes.json();
      const items: SitemapPost[] = postJson.data?.items || [];
      postEntries = items.map((p) => ({
        url: `${baseUrl}/kien-thuc/${p.slug}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }
  } catch {
    // If upstream services fail, return static routes safely
  }

  return [...staticEntries, ...productEntries, ...categoryEntries, ...postEntries];
}
