import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Layers, ArrowLeft, Package, Sparkles } from 'lucide-react';
import { Category, Product, ApiResponse } from '../../../../types/index';
import { ProductCard } from '../../../../components/customer/product-card';
import { Button } from '../../../../components/ui/button';

const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8080/api/v1';

interface Props {
  params: Promise<{ slug: string }> | { slug: string };
}

async function getCategory(slug: string): Promise<Category | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/categories/${slug}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json: ApiResponse<Category> = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

async function getCategoryProducts(categorySlug: string): Promise<Product[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/products?category=${encodeURIComponent(categorySlug)}&limit=50`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    const json: ApiResponse<{ items: Product[] }> = await res.json();
    return json.success && json.data?.items ? json.data.items : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const category = await getCategory(resolvedParams.slug);

  if (!category) {
    return {
      title: 'Danh mục không tồn tại | Phân Bón Shop',
      description: 'Nhóm sản phẩm không tồn tại hoặc đã ngừng áp dụng.',
    };
  }

  const title = `${category.name} | Phân Bón Shop`;
  const description =
    category.description ||
    `Tổng hợp tất cả sản phẩm ${category.name} chính hãng chất lượng cao, đúng quy chuẩn dinh dưỡng nông nghiệp.`;
  const canonicalUrl = `http://localhost:3000/danh-muc/${category.slug}`;

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

export default async function CategoryDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const category = await getCategory(resolvedParams.slug);

  if (!category) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <Layers className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          Không tìm thấy danh mục này
        </h2>
        <p className="text-xs text-gray-500">
          Danh mục bạn đang tìm kiếm có thể đã thay đổi hoặc không tồn tại.
        </p>
        <div className="pt-2">
          <Link href="/san-pham">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Xem tất cả sản phẩm
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const products = await getCategoryProducts(category.slug);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-gray-500">
        <Link href="/" className="hover:text-primary-700 transition-colors">
          Trang chủ
        </Link>
        <span>/</span>
        <Link href="/san-pham" className="hover:text-primary-700 transition-colors">
          Sản phẩm
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{category.name}</span>
      </nav>

      {/* Category Header Hero */}
      <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1 rounded-full text-xs font-semibold text-harvest-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Danh mục dinh dưỡng chuyên ngành</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-xs sm:text-sm text-primary-100 leading-relaxed max-w-2xl">
              {category.description}
            </p>
          )}
          <div className="pt-2 text-xs text-primary-200">
            Tổng cộng: <strong>{products.length}</strong> sản phẩm đang lưu hành
          </div>
        </div>
      </div>

      {/* Product List */}
      <div>
        {products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center space-y-3">
            <Package className="h-16 w-16 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-gray-900">
              Chưa có sản phẩm nào trong danh mục này
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Các sản phẩm thuộc nhóm này đang được kiểm định và nhập kho. Quý khách vui lòng tham khảo các danh mục phân bón khác.
            </p>
            <div className="pt-2">
              <Link href="/san-pham">
                <Button size="sm" variant="outline">
                  Xem tất cả sản phẩm
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
