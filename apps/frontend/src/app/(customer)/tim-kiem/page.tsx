import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, Package, ArrowRight } from 'lucide-react';
import { Product, ApiResponse } from '../../../types/index';
import { ProductCard } from '../../../components/customer/product-card';
import { SearchForm } from '../../../components/customer/search-form';
import { Button } from '../../../components/ui/button';

const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8080/api/v1';

interface Props {
  searchParams: Promise<{ q?: string; keyword?: string }> | { q?: string; keyword?: string };
}

async function searchProducts(
  keyword: string,
): Promise<{ items: Product[]; total: number }> {
  if (!keyword.trim()) {
    return { items: [], total: 0 };
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/products?keyword=${encodeURIComponent(keyword.trim())}&limit=40`,
      { cache: 'no-store' },
    );
    if (!res.ok) return { items: [], total: 0 };
    const json: ApiResponse<{ items: Product[]; total: number }> = await res.json();
    return json.success && json.data
      ? { items: json.data.items || [], total: json.data.total || 0 }
      : { items: [], total: 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const q = (resolvedParams.q || resolvedParams.keyword || '').trim();

  const title = q
    ? `Tìm kiếm: "${q}" | Phân Bón Shop`
    : 'Tra cứu sản phẩm phân bón chính hãng | Phân Bón Shop';
  const description = q
    ? `Kết quả tra cứu sản phẩm phân bón phù hợp với từ khóa "${q}". Sản phẩm chính hãng có kiểm định chất lượng.`
    : 'Tra cứu nhanh danh mục phân bón NPK, Đạm, Hữu cơ vi sinh từ các nhà sản xuất hàng đầu.';
  const canonicalUrl = `/tim-kiem${q ? `?q=${encodeURIComponent(q)}` : ''}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
    },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const queryParam = (resolvedParams.q || resolvedParams.keyword || '').trim();
  const { items: products, total } = await searchProducts(queryParam);
  const hasSearched = queryParam.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-gray-500">
        <Link href="/" className="hover:text-primary-700 transition-colors">
          Trang chủ
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Tìm kiếm</span>
        {queryParam && (
          <>
            <span>/</span>
            <span className="text-gray-500 truncate max-w-xs">&quot;{queryParam}&quot;</span>
          </>
        )}
      </nav>

      {/* Search Header Banner */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-5">
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
            Tra Cứu Phân Bón Chính Hãng
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Tìm nhanh theo tên sản phẩm, mã SKU, thương hiệu, hoặc thành phần dưỡng chất
          </p>
        </div>

        {/* Interactive Client Search Form */}
        <SearchForm initialQuery={queryParam} />
      </div>

      {/* Search Results Area */}
      <div>
        {!hasSearched ? (
          /* Initial empty prompt */
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center space-y-3">
            <Search className="h-14 w-14 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-gray-900">
              Vui lòng nhập từ khóa để tra cứu phân bón
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Hệ thống sẽ đối soát tên khoa học, mã lưu hành và nhãn hàng phân bón trực tiếp từ cơ sở dữ liệu.
            </p>
          </div>
        ) : products.length === 0 ? (
          /* No results empty state */
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center space-y-3">
            <Package className="h-16 w-16 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-gray-900">
              Không tìm thấy sản phẩm phù hợp với &quot;{queryParam}&quot;
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Kiểm tra lại chính tả hoặc thử tìm bằng các từ khóa tổng quát hơn như NPK, Đạm, Lân, Kali, Hữu cơ.
            </p>
            <div className="pt-2">
              <Link href="/san-pham">
                <Button size="sm" variant="outline">
                  Xem tất cả danh mục
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Results list */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div>
                Kết quả tìm kiếm cho: <strong className="text-gray-900">&quot;{queryParam}&quot;</strong> (Tìm thấy <strong>{total}</strong> sản phẩm)
              </div>
              <Link
                href="/san-pham"
                className="text-primary-700 hover:text-primary-800 font-semibold flex items-center space-x-1"
              >
                <span>Xem bộ lọc nâng cao</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
