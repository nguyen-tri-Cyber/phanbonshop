import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, ChevronRight, Home, ArrowLeft, BookOpen } from 'lucide-react';
import { Badge } from '../../../../components/ui/badge';

const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  (process.env.INTERNAL_GATEWAY_URL
    ? `${process.env.INTERNAL_GATEWAY_URL}/api/v1`
    : null) ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://gateway:8080/api/v1';

interface PostDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

async function getPost(slug: string): Promise<PostDetail | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/posts/slug/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const post = await getPost(resolvedParams.slug);

  if (!post) {
    return {
      title: 'Không tìm thấy bài viết | Phân Bón Shop',
    };
  }

  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || 'Kiến thức bón phân và chăm sóc cây trồng chính xác.';
  const url = `/kien-thuc/${post.slug}`;

  return {
    title: `${title} | Kiến Thức Nông Nghiệp Phân Bón Shop`,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      publishedTime: post.publishedAt || post.createdAt,
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : [],
    },
  };
}

export default async function BlogPostDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const post = await getPost(resolvedParams.slug);

  if (!post) {
    notFound();
  }

  const dateStr = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : new Date(post.createdAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

  // JSON-LD Structured Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.seoDescription || post.excerpt,
    image: post.coverImageUrl ? [post.coverImageUrl] : [],
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt || post.publishedAt || post.createdAt,
    author: {
      '@type': 'Organization',
      name: 'Phân Bón Shop - Ban Biên Tập Kỹ Thuật Nông Nghiệp',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Phân Bón Shop',
      url: siteUrl,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/kien-thuc/${post.slug}`,
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Trang chủ',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Kiến thức nông nghiệp',
        item: `${siteUrl}/kien-thuc`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: `${siteUrl}/kien-thuc/${post.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-xs text-gray-500 mb-6">
          <Link href="/" className="hover:text-primary-700 flex items-center space-x-1">
            <Home className="h-3.5 w-3.5" />
            <span>Trang chủ</span>
          </Link>
          <ChevronRight className="h-3 w-3 text-gray-400" />
          <Link href="/kien-thuc" className="hover:text-primary-700">
            Kiến thức nông nghiệp
          </Link>
          <ChevronRight className="h-3 w-3 text-gray-400" />
          <span className="text-gray-900 font-medium truncate max-w-xs sm:max-w-md">
            {post.title}
          </span>
        </nav>

        {/* Article Header */}
        <header className="mb-8">
          <div className="flex items-center space-x-2 mb-3">
            <Badge variant="success" className="text-xs">
              Kỹ Thuật Bón Phân
            </Badge>
            <span className="text-gray-300">•</span>
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              <span>{dateStr}</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight mb-4">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-base text-gray-600 italic leading-relaxed border-l-4 border-primary-500 pl-4 py-1 bg-primary-50/40 rounded-r">
              {post.excerpt}
            </p>
          )}
        </header>

        {/* Cover Image */}
        {post.coverImageUrl && (
          <div className="mb-8 rounded-2xl overflow-hidden shadow-sm aspect-video bg-gray-100">
            <img
              src={post.coverImageUrl}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Article Content */}
        <article className="prose prose-slate max-w-none text-gray-800 text-sm sm:text-base leading-relaxed mb-12 space-y-4 whitespace-pre-line">
          {post.content}
        </article>

        {/* Footer Navigation */}
        <div className="pt-6 border-t border-gray-200 flex items-center justify-between">
          <Link
            href="/kien-thuc"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-primary-700 hover:text-primary-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại danh mục kiến thức</span>
          </Link>

          <Link
            href="/san-pham"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Xem sản phẩm phân bón</span>
          </Link>
        </div>
      </div>
    </>
  );
}
