import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { Product, Category, Brand, ApiResponse } from '../../../types/index';
import { ProductCatalogView } from '../../../components/customer/product-catalog-view';

const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  (process.env.INTERNAL_GATEWAY_URL
    ? `${process.env.INTERNAL_GATEWAY_URL}/api/v1`
    : null) ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://gateway:8080/api/v1';

export const metadata: Metadata = {
  title: 'Danh mục phân bón chính hãng | Phân Bón Shop',
  description:
    'Tra cứu và đặt mua phân bón NPK, phân hữu cơ vi sinh, phân bón lá chất lượng cao từ Bình Điền Đầu Trâu, Đạm Phú Mỹ, Cà Mau.',
  alternates: {
    canonical: '/san-pham',
  },
  openGraph: {
    title: 'Danh mục phân bón chính hãng | Phân Bón Shop',
    description:
      'Tra cứu và đặt mua phân bón NPK, phân hữu cơ vi sinh, phân bón lá chất lượng cao từ Bình Điền Đầu Trâu, Đạm Phú Mỹ, Cà Mau.',
    url: '/san-pham',
    type: 'website',
  },
};

async function getInitialData() {
  try {
    const [catRes, brandRes, prodRes] = await Promise.all([
      fetch(`${API_BASE_URL}/categories`, { cache: 'no-store' }),
      fetch(`${API_BASE_URL}/brands`, { cache: 'no-store' }),
      fetch(`${API_BASE_URL}/products?page=1&limit=12`, { cache: 'no-store' }),
    ]);

    const catJson: ApiResponse<Category[]> = await catRes.json().catch(() => ({ success: false }));
    const brandJson: ApiResponse<Brand[]> = await brandRes.json().catch(() => ({ success: false }));
    const prodJson: ApiResponse<{
      items: Product[];
      total: number;
      page: number;
      totalPages: number;
    }> = await prodRes.json().catch(() => ({ success: false }));

    const categories =
      catJson.success && Array.isArray(catJson.data)
        ? catJson.data.filter((c) => c.status === 'ACTIVE')
        : [];
    const brands = brandJson.success && Array.isArray(brandJson.data) ? brandJson.data : [];
    const products = prodJson.success && prodJson.data?.items ? prodJson.data.items : [];
    const total = prodJson.success && prodJson.data?.total ? prodJson.data.total : 0;
    const totalPages =
      prodJson.success && prodJson.data?.totalPages ? prodJson.data.totalPages : 1;

    return { categories, brands, products, total, totalPages };
  } catch {
    return { categories: [], brands: [], products: [], total: 0, totalPages: 1 };
  }
}

export default async function ProductsPage() {
  const { categories, brands, products, total, totalPages } = await getInitialData();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Suspense fallback={<div className="p-12 text-center text-xs text-gray-500">Đang tải danh mục...</div>}>
        <ProductCatalogView
          initialCategories={categories}
          initialBrands={brands}
          initialProducts={products}
          initialTotal={total}
          initialTotalPages={totalPages}
        />
      </Suspense>
    </div>
  );
}
