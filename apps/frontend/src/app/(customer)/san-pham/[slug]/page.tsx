import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Product, InventoryItem, ApiResponse } from '../../../../types/index';
import { ProductDetailView } from '../../../../components/customer/product-detail-view';
import { Button } from '../../../../components/ui/button';

const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8080/api/v1';

interface Props {
  params: Promise<{ slug: string }> | { slug: string };
}

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${slug}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json: ApiResponse<Product> = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

async function getProductInventory(productId: string): Promise<InventoryItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/inventory/products/${productId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json: ApiResponse<InventoryItem[]> = await res.json();
    return json.success && Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

async function getProductReviews(productId: string): Promise<{ total: number; averageRating: number }> {
  try {
    const res = await fetch(`${API_BASE_URL}/reviews/products/${productId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return { total: 0, averageRating: 0 };
    const json = await res.json();
    return {
      total: json.data?.total || json.data?.stats?.totalReviews || 0,
      averageRating: json.data?.stats?.averageRating || json.data?.averageRating || 0,
    };
  } catch {
    return { total: 0, averageRating: 0 };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const product = await getProduct(resolvedParams.slug);

  if (!product) {
    return {
      title: 'Không tìm thấy sản phẩm | Phân Bón Shop',
      description: 'Sản phẩm không tồn tại hoặc đã ngừng lưu hành trên hệ thống.',
    };
  }

  const title = product.seoTitle || `${product.name} | Phân Bón Shop`;
  const description =
    product.seoDescription ||
    product.shortDescription ||
    `Mua ${product.name} chính hãng giá tốt, xuất xứ rõ ràng, có bảo hành mùa vụ tại Phân Bón Shop.`;
  const canonicalUrl = `http://localhost:3000/san-pham/${product.slug}`;

  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
  const ogImages = primaryImage?.url ? [{ url: primaryImage.url, alt: product.name }] : [];

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
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: primaryImage?.url ? [primaryImage.url] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const resolvedParams = await params;
  const product = await getProduct(resolvedParams.slug);

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          Không tìm thấy sản phẩm này
        </h2>
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          Sản phẩm bạn đang tìm kiếm có thể đã tạm ngừng kinh doanh hoặc đường dẫn không chính xác.
        </p>
        <div className="pt-2">
          <Link href="/san-pham">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Về danh mục sản phẩm
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const [inventory, reviewStats] = await Promise.all([
    getProductInventory(product.id),
    getProductReviews(product.id),
  ]);

  const primaryVariant = product.variants?.[0];
  const price = Number(primaryVariant?.price || product.price);
  const totalAvailableStock = inventory.reduce(
    (sum, item) => sum + item.availableQuantity,
    0,
  );

  // Structured Data (JSON-LD) - Product Schema
  const productJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription || product.description || product.name,
    image: product.images?.map((img) => img.url) || [],
    sku: primaryVariant?.sku || product.sku,
    offers: {
      '@type': 'Offer',
      price: isNaN(price) ? 0 : price,
      priceCurrency: 'VND',
      availability:
        totalAvailableStock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: `http://localhost:3000/san-pham/${product.slug}`,
    },
  };

  if (product.brand) {
    productJsonLd.brand = {
      '@type': 'Brand',
      name: product.brand.name,
    };
  }

  // KHÔNG FAKE RATING: Chỉ thêm aggregateRating nếu CÓ review THẬT (> 0)
  if (reviewStats.total > 0 && reviewStats.averageRating > 0) {
    productJsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviewStats.averageRating,
      reviewCount: reviewStats.total,
    };
  }

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Trang chủ',
        item: 'http://localhost:3000',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: product.category?.name || 'Sản phẩm',
        item: product.category
          ? `http://localhost:3000/danh-muc/${product.category.slug}`
          : 'http://localhost:3000/san-pham',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: `http://localhost:3000/san-pham/${product.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ProductDetailView product={product} initialInventory={inventory} />
      </div>
    </>
  );
}
