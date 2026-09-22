'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  TrendingUp,
  ShoppingBag,
  Sparkles,
  Package,
  Layers,
  Award,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { Product, Category, Banner } from '../../types/index';
import { formatCurrencyVND } from '../../lib/formatters';
import { useCart } from '../../contexts/cart-context';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Alert, AlertDescription } from '../../components/ui/alert';

export default function HomePage() {
  const { addItem } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [heroBanners, setHeroBanners] = useState<Banner[]>([]);
  const [middleBanners, setMiddleBanners] = useState<Banner[]>([]);
  const [currentHeroIndex, setCurrentHeroIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadHomeData() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [catRes, featRes, bestRes, heroBannerRes, middleBannerRes] = await Promise.all([
          apiClient<Category[]>('/categories'),
          apiClient<{ items: Product[] }>('/products?featured=true&limit=4'),
          apiClient<{ items: Product[] }>('/products?bestSeller=true&limit=4'),
          apiClient<Banner[]>('/banners?position=HOME_HERO'),
          apiClient<Banner[]>('/banners?position=HOME_MIDDLE'),
        ]);

        if (catRes.success && catRes.data) {
          setCategories(catRes.data.filter((c) => c.status === 'ACTIVE'));
        }

        if (featRes.success && featRes.data) {
          setFeaturedProducts(featRes.data.items || []);
        }

        if (bestRes.success && bestRes.data) {
          setBestSellers(bestRes.data.items || []);
        }

        if (heroBannerRes.success && Array.isArray(heroBannerRes.data)) {
          setHeroBanners(heroBannerRes.data);
        }

        if (middleBannerRes.success && Array.isArray(middleBannerRes.data)) {
          setMiddleBanners(middleBannerRes.data);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Lỗi kết nối máy chủ dữ liệu',
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadHomeData();
  }, []);

  const handleAddToCart = (product: Product) => {
    const primaryVariant =
      product.variants?.find((v) => v.status === 'ACTIVE') || product.variants?.[0];

    if (!primaryVariant) {
      window.location.href = `/san-pham/${product.slug}`;
      return;
    }

    const price = Number(primaryVariant.price || product.price);

    addItem({
      variantId: primaryVariant.id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      sku: primaryVariant.sku || product.sku,
      packageSize: primaryVariant.packageSize || 'Tiêu chuẩn',
      price: isNaN(price) ? 0 : price,
      quantity: 1,
      imageUrl: product.images?.[0]?.url,
    });
  };

  return (
    <div className="space-y-12 pb-16">
      {/* 1. Hero Agricultural Banner (Lấy từ API HOME_HERO thật, fallback nếu không có banner) */}
      {heroBanners.length > 0 ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="relative rounded-2xl overflow-hidden shadow-lg aspect-[21/9] sm:aspect-[24/9] md:aspect-[3/1] bg-gray-900 group">
            <img
              src={heroBanners[currentHeroIndex].imageUrl}
              alt={heroBanners[currentHeroIndex].title}
              className="w-full h-full object-cover transition-all duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-6 sm:p-10">
              <span className="inline-flex items-center space-x-1.5 bg-harvest-500/90 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full w-max mb-2 backdrop-blur-sm">
                <Sparkles className="h-3 w-3" />
                <span>Khuyến Mãi Nông Nghiệp</span>
              </span>
              <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-white drop-shadow max-w-2xl leading-tight">
                {heroBanners[currentHeroIndex].title}
              </h1>
              {heroBanners[currentHeroIndex].targetUrl && (
                <div className="mt-4">
                  <Link href={heroBanners[currentHeroIndex].targetUrl!}>
                    <Button size="sm" className="bg-harvest-500 hover:bg-harvest-600 text-white font-bold space-x-2">
                      <span>Xem Ngay</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {heroBanners.length > 1 && (
              <div className="absolute bottom-4 right-6 flex items-center space-x-2 z-10">
                {heroBanners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentHeroIndex(idx)}
                    className={`h-2.5 rounded-full transition-all ${
                      idx === currentHeroIndex ? 'w-8 bg-harvest-400' : 'w-2.5 bg-white/50 hover:bg-white'
                    }`}
                    aria-label={`Banner ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="relative bg-gradient-to-r from-primary-900 via-primary-800 to-emerald-900 text-white py-14 px-4 sm:px-6 lg:px-8 shadow-md overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-5">
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1 rounded-full text-xs font-semibold text-harvest-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Giải Pháp Dinh Dưỡng Cây Trồng Vụ Mùa 2026</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                Sàn Giao Dịch Phân Bón <br />
                <span className="text-harvest-400">Chính Hãng Từ Nhà Máy</span>
              </h1>
              <p className="text-sm sm:text-base text-primary-100 max-w-2xl leading-relaxed">
                Cung ứng phân bón NPK tháp cao, phân hữu cơ vi sinh, phân bón lá chuyên dùng cho vùng canh tác Lúa, Cây Ăn Trái ĐBSCL và Cây Công Nghiệp Tây Nguyên.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/san-pham">
                  <Button size="lg" className="bg-harvest-500 hover:bg-harvest-600 text-white font-bold space-x-2 shadow-lg">
                    <span>Xem Toàn Bộ Sản Phẩm</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/san-pham?category=phan-bon-huu-co-vi-sinh">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 font-medium">
                    Phân Bón Hữu Cơ Sinh Học
                  </Button>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/15 space-y-3">
              <div className="flex items-center space-x-2 text-harvest-300 font-bold text-sm">
                <Award className="h-5 w-5" />
                <span>Cam Kết Chất Lượng Phân Bón</span>
              </div>
              <ul className="text-xs text-primary-100 space-y-2">
                <li className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-harvest-400" />
                  <span>100% Phân bón có tem kiểm định và hóa đơn VAT</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-harvest-400" />
                  <span>Nhập trực tiếp từ Bình Điền, Đạm Phú Mỹ, PVCFC</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-harvest-400" />
                  <span>Bảo hiểm rủi ro mùa vụ, đền bù nếu sai hàm lượng</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-harvest-400" />
                  <span>Hệ thống kho trung chuyển giao tận chân ruộng</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Lỗi kết nối máy chủ */}
      {errorMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Alert variant="warning">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* 2. Danh Mục Phân Bón Lấy Thật từ API */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
              <Layers className="h-6 w-6 text-primary-600" />
              <span>Danh Mục Phân Bón Lưu Hành</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Phân loại dinh dưỡng theo quy chuẩn Cục Bảo vệ thực vật
            </p>
          </div>
          <Link
            href="/san-pham"
            className="text-xs sm:text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center space-x-1"
          >
            <span>Xem tất cả ({categories.length})</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-6 border border-gray-200 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <Package className="h-10 w-10 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Chưa có danh mục nào trên hệ thống</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/danh-muc/${cat.slug}`}
                className="group relative rounded-2xl p-6 bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-primary-500 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="h-2 w-2 rounded-full bg-primary-600" />
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Danh Mục
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base group-hover:text-primary-700 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                    {cat.description || 'Các dòng sản phẩm chuyên dùng cung cấp dinh dưỡng toàn diện cho cây trồng.'}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center text-xs font-semibold text-primary-600 group-hover:text-primary-700">
                  <span>Khám phá các sản phẩm</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 3. Sản Phẩm Nổi Bật (Featured Products từ API) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
              <Sparkles className="h-6 w-6 text-harvest-500" />
              <span>Sản Phẩm Tiêu Biểu Vụ Mùa</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Phân bón chất lượng cao được tuyển chọn cho giai đoạn bón thúc và làm đòng
            </p>
          </div>
          <Link
            href="/san-pham?featured=true"
            className="text-xs sm:text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center space-x-1"
          >
            <span>Xem thêm</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-4 border border-gray-200 space-y-3">
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-xs text-gray-500">
            Chưa có sản phẩm tiêu biểu nào được kích hoạt.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => {
              const primaryVariant = product.variants?.[0];
              const price = Number(primaryVariant?.price || product.price);
              const imageUrl = product.images?.[0]?.url;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="p-4 bg-gray-50 flex items-center justify-center relative min-h-[190px]">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.name}
                        className="h-36 w-36 object-contain group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-primary-100/80 flex items-center justify-center text-primary-700 text-3xl font-bold">
                        🌱
                      </div>
                    )}
                    <Badge variant="secondary" className="absolute top-3 left-3 text-[10px]">
                      Tiêu biểu
                    </Badge>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-[11px] font-semibold text-primary-700 uppercase tracking-wide">
                        {product.brand?.name || 'Chính Hãng'}
                      </div>
                      <Link href={`/san-pham/${product.slug}`}>
                        <h4 className="font-bold text-gray-900 text-sm mt-0.5 line-clamp-2 hover:text-primary-700 transition-colors">
                          {product.name}
                        </h4>
                      </Link>
                      {primaryVariant?.packageSize && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          Quy cách: <strong>{primaryVariant.packageSize}</strong>
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-gray-400">Giá bán lẻ:</div>
                        <div className="text-base font-black text-primary-800">
                          {formatCurrencyVND(price)}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(product)}
                        className="h-8 px-2.5 space-x-1 text-xs"
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        <span>Mua</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* HOME_MIDDLE Banner nếu có cấu hình */}
      {middleBanners.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-2xl overflow-hidden shadow-md aspect-[4/1] bg-gray-100">
            {middleBanners[0].targetUrl ? (
              <Link href={middleBanners[0].targetUrl}>
                <img
                  src={middleBanners[0].imageUrl}
                  alt={middleBanners[0].title}
                  className="w-full h-full object-cover hover:scale-[1.01] transition-transform duration-300"
                />
              </Link>
            ) : (
              <img
                src={middleBanners[0].imageUrl}
                alt={middleBanners[0].title}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        </section>
      )}

      {/* 4. Sản Phẩm Bán Chạy (Best Sellers từ API) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
              <TrendingUp className="h-6 w-6 text-primary-600" />
              <span>Sản Phẩm Bán Chạy Nhất</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Được bà con các hợp tác xã nông nghiệp đặt mua nhiều nhất
            </p>
          </div>
          <Link
            href="/san-pham?bestSeller=true"
            className="text-xs sm:text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center space-x-1"
          >
            <span>Xem thêm</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-4 border border-gray-200 space-y-3">
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : bestSellers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-xs text-gray-500">
            Chưa có sản phẩm bán chạy nào được ghi nhận.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {bestSellers.map((product) => {
              const primaryVariant = product.variants?.[0];
              const price = Number(primaryVariant?.price || product.price);
              const imageUrl = product.images?.[0]?.url;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="p-4 bg-gray-50 flex items-center justify-center relative min-h-[190px]">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.name}
                        className="h-36 w-36 object-contain group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-primary-100/80 flex items-center justify-center text-primary-700 text-3xl font-bold">
                        🌱
                      </div>
                    )}
                    <Badge variant="default" className="absolute top-3 left-3 text-[10px]">
                      Bán chạy
                    </Badge>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-[11px] font-semibold text-primary-700 uppercase tracking-wide">
                        {product.brand?.name || 'Chính Hãng'}
                      </div>
                      <Link href={`/san-pham/${product.slug}`}>
                        <h4 className="font-bold text-gray-900 text-sm mt-0.5 line-clamp-2 hover:text-primary-700 transition-colors">
                          {product.name}
                        </h4>
                      </Link>
                      {primaryVariant?.packageSize && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          Quy cách: <strong>{primaryVariant.packageSize}</strong>
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-gray-400">Giá bán lẻ:</div>
                        <div className="text-base font-black text-primary-800">
                          {formatCurrencyVND(price)}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(product)}
                        className="h-8 px-2.5 space-x-1 text-xs"
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        <span>Mua</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
