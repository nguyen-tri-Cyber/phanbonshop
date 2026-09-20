import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, ArrowLeft, Package, ShieldCheck } from 'lucide-react';
import { Brand, Product, ApiResponse } from '../../../../types/index';
import { ProductCard } from '../../../../components/customer/product-card';
import { Button } from '../../../../components/ui/button';

const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  (process.env.INTERNAL_GATEWAY_URL
    ? `${process.env.INTERNAL_GATEWAY_URL}/api/v1`
    : null) ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://gateway:8080/api/v1';

interface Props {
  params: Promise<{ slug: string }> | { slug: string };
}

async function getBrand(slug: string): Promise<Brand | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/brands/${slug}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json: ApiResponse<Brand> = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

async function getBrandProducts(brandSlug: string): Promise<Product[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/products?brand=${encodeURIComponent(brandSlug)}&limit=50`,
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
  const brand = await getBrand(resolvedParams.slug);

  if (!brand) {
    return {
      title: 'Thương hiệu không tồn tại | Phân Bón Shop',
      description: 'Nhà sản xuất phân bón không tồn tại trên hệ thống.',
    };
  }

  const title = `Phân bón ${brand.name} | Phân Bón Shop`;
  const description =
    brand.description ||
    `Sản phẩm phân bón chính hãng thương hiệu ${brand.name} phân phối trực tiếp từ nhà máy có tem bảo hành chất lượng.`;
  const canonicalUrl = `/thuong-hieu/${brand.slug}`;
  const ogImages = brand.logoUrl ? [{ url: brand.logoUrl, alt: brand.name }] : [];

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
      images: ogImages,
    },
  };
}

export default async function BrandDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const brand = await getBrand(resolvedParams.slug);

  if (!brand) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <Award className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          Không tìm thấy thương hiệu này
        </h2>
        <p className="text-xs text-gray-500">
          Nhà sản xuất bạn đang tìm kiếm có thể đã thay đổi hoặc không tồn tại.
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

  const products = await getBrandProducts(brand.slug);

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
        <span className="text-gray-900 font-medium">{brand.name}</span>
      </nav>

      {/* Brand Header Banner with Real MinIO Logo */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
        <div className="w-48 h-24 sm:h-28 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center p-3 flex-shrink-0">
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <Award className="h-12 w-12 text-harvest-500" />
          )}
        </div>

        <div className="flex-1 space-y-2 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
              {brand.name}
            </h1>
            <div className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Đối tác sản xuất chính thức</span>
            </div>
          </div>
          {brand.description && (
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-2xl">
              {brand.description}
            </p>
          )}
          <div className="text-xs text-gray-500 pt-1">
            Tổng sản phẩm phân phối: <strong>{products.length}</strong> sản phẩm
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div>
        {products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center space-y-3">
            <Package className="h-16 w-16 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-gray-900">
              Chưa có sản phẩm nào thuộc thương hiệu này
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Sản phẩm từ nhà máy đang được vận chuyển đến kho tổng. Quý khách vui lòng tham khảo các thương hiệu phân bón khác.
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
