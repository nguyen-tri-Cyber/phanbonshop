import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, BookOpen, ArrowRight, Sprout } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';

const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8080/api/v1';

export const metadata: Metadata = {
  title: 'Kiến Thức Nông Nghiệp & Cẩm Nang Bón Phân | Phân Bón Shop',
  description:
    'Chia sẻ kỹ thuật bón phân, cẩm nang chăm sóc cây trồng, thời điểm bón NPK và cách phòng trừ sâu bệnh đạt năng suất cao nhất.',
  alternates: {
    canonical: 'http://localhost:3000/kien-thuc',
  },
  openGraph: {
    title: 'Kiến Thức Nông Nghiệp & Cẩm Nang Bón Phân | Phân Bón Shop',
    description:
      'Chia sẻ kỹ thuật bón phân, cẩm nang chăm sóc cây trồng, thời điểm bón NPK và cách phòng trừ sâu bệnh đạt năng suất cao nhất.',
    url: 'http://localhost:3000/kien-thuc',
    type: 'website',
  },
};

interface PostItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
}

async function getPosts(page: number = 1, search?: string) {
  try {
    const url = new URL(`${API_BASE_URL}/posts`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', '12');
    if (search) url.searchParams.set('search', search);

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return { items: [], total: 0, page: 1, totalPages: 1 };
    const json = await res.json();
    return json.data || { items: [], total: 0, page: 1, totalPages: 1 };
  } catch {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }
}

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const resolvedParams = await searchParams;
  const page = Math.max(1, Number(resolvedParams?.page) || 1);
  const search = resolvedParams?.q || '';
  const data = await getPosts(page, search);

  const posts: PostItem[] = data.items || [];
  const totalPages: number = data.totalPages || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary-800 to-primary-900 rounded-2xl p-8 text-white mb-8 shadow-sm relative overflow-hidden">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center space-x-2 bg-primary-700/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-harvest-300 mb-3 border border-primary-600/40">
            <Sprout className="h-3.5 w-3.5" />
            <span>Kỹ Thuật Canh Tác Nông Nghiệp Hiện Đại</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
            Cẩm Nang & Kiến Thức Bón Phân
          </h1>
          <p className="text-sm text-primary-100 leading-relaxed">
            Tổng hợp hướng dẫn kỹ thuật bón phân NPK, phục hồi đất chua phèn, xử lý sâu bệnh và bí quyết mùa màng bội thu từ đội ngũ kỹ sư nông nghiệp.
          </p>
        </div>
        <div className="absolute right-4 -bottom-6 opacity-10 pointer-events-none text-white hidden md:block">
          <BookOpen className="w-56 h-56" />
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 bg-white p-4 rounded-xl border border-gray-200">
        <form method="GET" className="w-full sm:w-80 flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="Tìm kiếm bài viết, kỹ thuật..."
            className="flex-1 px-3.5 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary-600"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary-700 text-white text-xs font-semibold rounded-lg hover:bg-primary-800 transition-colors"
          >
            Tìm
          </button>
        </form>

        <div className="text-xs text-gray-500">
          Tổng cộng <span className="font-bold text-gray-900">{data.total}</span> bài viết chia sẻ
        </div>
      </div>

      {/* Blog Cards Grid */}
      {posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-800">Chưa có bài viết kiến thức nào</p>
          <p className="text-xs text-gray-500 mt-1">Các bài viết kỹ thuật nông nghiệp đang được ban biên tập cập nhật.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => {
            const dateStr = post.publishedAt
              ? new Date(post.publishedAt).toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : null;

            return (
              <article
                key={post.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col group"
              >
                <Link href={`/kien-thuc/${post.slug}`} className="relative aspect-video bg-gray-100 overflow-hidden block">
                  {post.coverImageUrl ? (
                    <img
                      src={post.coverImageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-primary-50/50">
                      <Sprout className="h-10 w-10 text-primary-400 mb-1" />
                      <span className="text-[11px] font-medium text-primary-700">Kiến Thức Nông Nghiệp</span>
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <Badge variant="success" className="text-[10px] shadow-sm">
                      Kỹ Thuật
                    </Badge>
                  </div>
                </Link>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {dateStr && (
                      <div className="flex items-center space-x-1.5 text-[11px] text-gray-500 mb-2">
                        <Calendar className="h-3 w-3" />
                        <span>{dateStr}</span>
                      </div>
                    )}
                    <h2 className="text-base font-bold text-gray-900 group-hover:text-primary-700 transition-colors line-clamp-2 mb-2 leading-snug">
                      <Link href={`/kien-thuc/${post.slug}`}>{post.title}</Link>
                    </h2>
                    {post.excerpt && (
                      <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed mb-4">
                        {post.excerpt}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-primary-700 group-hover:text-primary-800">
                    <span>Đọc tiếp</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center space-x-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/kien-thuc?page=${p}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                p === page
                  ? 'bg-primary-700 text-white border-primary-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
