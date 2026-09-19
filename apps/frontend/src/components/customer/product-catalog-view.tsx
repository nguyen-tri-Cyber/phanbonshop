'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SlidersHorizontal,
  RotateCcw,
  Package,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { Product, Category, Brand } from '../../types/index';
import { ProductCard } from './product-card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';

interface ProductCatalogViewProps {
  initialCategories: Category[];
  initialBrands: Brand[];
  initialProducts: Product[];
  initialTotal: number;
  initialTotalPages: number;
}

const PRICE_RANGES = [
  { label: 'Tất cả mức giá', min: null, max: null },
  { label: 'Dưới 100.000đ', min: null, max: '100000' },
  { label: '100.000đ - 300.000đ', min: '100000', max: '300000' },
  { label: '300.000đ - 500.000đ', min: '300000', max: '500000' },
  { label: 'Trên 500.000đ', min: '500000', max: null },
];

export function ProductCatalogView({
  initialCategories,
  initialBrands,
  initialProducts,
  initialTotal,
  initialTotalPages,
}: ProductCatalogViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL search params
  const categoryParam = searchParams.get('category') || '';
  const brandParam = searchParams.get('brand') || '';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';
  const sortParam = searchParams.get('sort') || 'newest';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const keywordParam = searchParams.get('keyword') || searchParams.get('search') || '';

  // State
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories] = useState<Category[]>(initialCategories);
  const [brands] = useState<Brand[]>(initialBrands);
  const [total, setTotal] = useState<number>(initialTotal);
  const [totalPages, setTotalPages] = useState<number>(initialTotalPages);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Local filter inputs
  const [searchQuery, setSearchQuery] = useState(keywordParam);
  const [minPriceInput, setMinPriceInput] = useState(minPriceParam);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceParam);

  // Sync state when URL params change and fetch products
  useEffect(() => {
    setSearchQuery(keywordParam);
    setMinPriceInput(minPriceParam);
    setMaxPriceInput(maxPriceParam);

    // Skip refetching on initial mount if searchParams match defaults
    const isDefault =
      !categoryParam &&
      !brandParam &&
      !minPriceParam &&
      !maxPriceParam &&
      sortParam === 'newest' &&
      pageParam === 1 &&
      !keywordParam;

    if (isDefault && initialProducts.length > 0) {
      return;
    }

    async function fetchProducts() {
      setIsLoading(true);
      setErrorMessage(null);

      const query = new URLSearchParams();
      query.set('page', pageParam.toString());
      query.set('limit', '12');

      if (categoryParam) query.set('category', categoryParam);
      if (brandParam) query.set('brand', brandParam);
      if (minPriceParam) query.set('minPrice', minPriceParam);
      if (maxPriceParam) query.set('maxPrice', maxPriceParam);
      if (sortParam) query.set('sort', sortParam);
      if (keywordParam) query.set('keyword', keywordParam);

      try {
        const res = await apiClient<{
          items: Product[];
          total: number;
          page: number;
          totalPages: number;
        }>(`/products?${query.toString()}`);

        if (res.success) {
          setProducts(res.data.items || []);
          setTotal(res.data.total || 0);
          setTotalPages(res.data.totalPages || 1);
        } else {
          setErrorMessage(res.error?.message || 'Không thể tải danh sách sản phẩm');
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Lỗi kết nối máy chủ dữ liệu',
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchProducts();
  }, [
    categoryParam,
    brandParam,
    minPriceParam,
    maxPriceParam,
    sortParam,
    pageParam,
    keywordParam,
    initialProducts,
  ]);

  // Helper update URL query
  const updateQuery = (updates: Record<string, string | null>) => {
    const current = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        current.delete(key);
      } else {
        current.set(key, value);
      }
    });
    if (!('page' in updates)) {
      current.delete('page');
    }
    router.push(`/san-pham?${current.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery({ keyword: searchQuery.trim() || null });
  };

  const handlePriceRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery({
      minPrice: minPriceInput.trim() || null,
      maxPrice: maxPriceInput.trim() || null,
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setMinPriceInput('');
    setMaxPriceInput('');
    router.push('/san-pham');
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-gray-500 mb-2">
            <Link href="/" className="hover:text-primary-700 transition-colors">
              Trang chủ
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">Danh mục sản phẩm</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Tất Cả Sản Phẩm Phân Bón
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Hiển thị <strong>{total}</strong> sản phẩm phân bón chính hãng có kiểm định chất lượng
          </p>
        </div>

        {/* Search keyword input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc SKU..."
            className="pr-10 text-xs"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-primary-700"
            aria-label="Tìm kiếm"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Main Content Layout: Filters Sidebar + Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Filters Sidebar (Col 3) */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2 font-bold text-sm text-gray-900">
                <SlidersHorizontal className="h-4 w-4 text-primary-600" />
                <span>Bộ Lọc Sản Phẩm</span>
              </div>
              {(categoryParam || brandParam || minPriceParam || maxPriceParam || keywordParam) && (
                <button
                  onClick={handleResetFilters}
                  className="text-[11px] font-semibold text-primary-600 hover:text-primary-800 flex items-center space-x-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Đặt lại</span>
                </button>
              )}
            </div>

            {/* Filter 1: Danh mục thực tế từ API */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Danh Mục Phân Bón
              </h3>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => updateQuery({ category: null })}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    !categoryParam
                      ? 'bg-primary-50 text-primary-800 font-bold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Tất cả danh mục
                </button>
                {categories.map((c) => {
                  const isActive = categoryParam === c.slug;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => updateQuery({ category: c.slug })}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-800 font-bold'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter 2: Thương hiệu thực tế từ API */}
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Thương Hiệu Sản Xuất
              </h3>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => updateQuery({ brand: null })}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    !brandParam
                      ? 'bg-primary-50 text-primary-800 font-bold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Tất cả thương hiệu
                </button>
                {brands.map((b) => {
                  const isActive = brandParam === b.slug;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => updateQuery({ brand: b.slug })}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-800 font-bold'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {b.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter 3: Khoảng giá */}
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Khoảng Giá Bán
              </h3>
              <div className="space-y-1">
                {PRICE_RANGES.map((range, idx) => {
                  const isSelected =
                    (!range.min && !range.max && !minPriceParam && !maxPriceParam) ||
                    (range.min === minPriceParam && range.max === maxPriceParam);

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        updateQuery({
                          minPrice: range.min,
                          maxPrice: range.max,
                        })
                      }
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        isSelected
                          ? 'bg-primary-50 text-primary-800 font-bold'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {range.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom price inputs */}
              <form onSubmit={handlePriceRangeSubmit} className="pt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Từ đ"
                    value={minPriceInput}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    className="text-xs h-8 px-2"
                  />
                  <Input
                    type="number"
                    placeholder="Đến đ"
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    className="text-xs h-8 px-2"
                  />
                </div>
                <Button type="submit" variant="outline" size="sm" className="w-full text-xs h-7">
                  Áp dụng giá
                </Button>
              </form>
            </div>
          </div>
        </aside>

        {/* Main Product Grid Area (Col 9) */}
        <main className="lg:col-span-9 space-y-6">
          {/* Sorting Header Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center space-x-2 text-gray-600">
              <span>Sắp xếp theo:</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => updateQuery({ sort: 'newest' })}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  sortParam === 'newest'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Mới nhất
              </button>
              <button
                type="button"
                onClick={() => updateQuery({ sort: 'price_asc' })}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  sortParam === 'price_asc'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Giá tăng dần
              </button>
              <button
                type="button"
                onClick={() => updateQuery({ sort: 'price_desc' })}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  sortParam === 'price_desc'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Giá giảm dần
              </button>
            </div>
          </div>

          {/* Error display */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
              {errorMessage}
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-white rounded-2xl p-4 border border-gray-200 space-y-3">
                  <Skeleton className="h-48 w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center space-y-3">
              <Package className="h-16 w-16 text-gray-300 mx-auto" />
              <h3 className="text-base font-bold text-gray-900">
                Không tìm thấy sản phẩm phân bón phù hợp
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Hãy thử nới lỏng bộ lọc danh mục, thương hiệu hoặc tìm kiếm với từ khóa khác.
              </p>
              <div className="pt-2">
                <Button size="sm" variant="outline" onClick={handleResetFilters}>
                  Xóa tất cả bộ lọc
                </Button>
              </div>
            </div>
          ) : (
            /* Real Products Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 pt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={pageParam <= 1}
                onClick={() => updateQuery({ page: (pageParam - 1).toString() })}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === pageParam ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateQuery({ page: p.toString() })}
                  className="h-8 w-8 p-0 text-xs"
                >
                  {p}
                </Button>
              ))}

              <Button
                variant="outline"
                size="sm"
                disabled={pageParam >= totalPages}
                onClick={() => updateQuery({ page: (pageParam + 1).toString() })}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
