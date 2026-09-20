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

async function safeFetchJson<T>(url: string, timeoutMs = 1500): Promise<T | null> {
  // Chỉ fetch nếu là URL HTTP(S) tuyệt đối hợp lệ
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
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
    const [prodJson, catJson, postJson] = await Promise.all([
      safeFetchJson<{ data?: { items?: SitemapProduct[] } }>(`${API_BASE_URL}/products?limit=100`),
      safeFetchJson<{ data?: SitemapCategory[] }>(`${API_BASE_URL}/categories`),
      safeFetchJson<{ data?: { items?: SitemapPost[] } }>(`${API_BASE_URL}/posts?limit=100`),
    ]);

    if (prodJson?.data?.items) {
      productEntries = prodJson.data.items.map((p) => ({
        url: `${baseUrl}/san-pham/${p.slug}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
    }

    if (catJson?.data) {
      categoryEntries = catJson.data
        .filter((c) => c.status === 'ACTIVE')
        .map((c) => ({
          url: `${baseUrl}/danh-muc/${c.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        }));
    }

    if (postJson?.data?.items) {
      postEntries = postJson.data.items.map((p) => ({
        url: `${baseUrl}/kien-thuc/${p.slug}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }
  } catch {
    // Graceful fallback nếu upstream services không khả dụng
  }

  return [...staticEntries, ...productEntries, ...categoryEntries, ...postEntries];
}
