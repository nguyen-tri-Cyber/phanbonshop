'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Layers,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Package,
  Plus,
  Minus,
  Check,
  Sprout,
  Calendar,
  Compass,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { Product, ProductVariant, ProductImage, InventoryItem } from '../../types/index';
import { formatCurrencyVND } from '../../lib/formatters';
import { useCart } from '../../contexts/cart-context';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface ProductDetailViewProps {
  product: Product;
  initialInventory?: InventoryItem[];
}

export function ProductDetailView({
  product,
  initialInventory = [],
}: ProductDetailViewProps) {
  const { addItem } = useCart();

  // Selected variant state (defaults to first variant)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants && product.variants.length > 0 ? product.variants[0] : null,
  );

  // Gallery images & active image
  const images: ProductImage[] = product.images || [];
  const primaryImage = images.find((img) => img.isPrimary) || images[0];
  const [activeImageUrl, setActiveImageUrl] = useState<string>(
    primaryImage?.url || '',
  );

  // Live inventory state
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(initialInventory);
  const [isInventoryLoading, setIsInventoryLoading] = useState<boolean>(false);
  const [inventoryError, setInventoryError] = useState<boolean>(false);

  // Quantity to add
  const [quantity, setQuantity] = useState<number>(1);
  const [isAddedSuccess, setIsAddedSuccess] = useState<boolean>(false);

  // Active tab state
  type TabKey = 'description' | 'composition' | 'usage' | 'storage' | 'warning';
  const [activeTab, setActiveTab] = useState<TabKey>('description');

  // Fetch real inventory on mount or when product changes
  useEffect(() => {
    let isMounted = true;
    async function fetchInventory() {
      setIsInventoryLoading(true);
      setInventoryError(false);
      try {
        const res = await apiClient<InventoryItem[]>(
          `/inventory/products/${product.id}`,
        );
        if (isMounted) {
          if (res.success && Array.isArray(res.data)) {
            setInventoryList(res.data);
          } else {
            setInventoryError(true);
          }
        }
      } catch {
        if (isMounted) {
          setInventoryError(true);
        }
      } finally {
        if (isMounted) {
          setIsInventoryLoading(false);
        }
      }
    }

    fetchInventory();
    return () => {
      isMounted = false;
    };
  }, [product.id]);

  // Find inventory item for the currently selected variant
  const currentInventory = selectedVariant
    ? inventoryList.find((item) => item.variantId === selectedVariant.id)
    : null;

  // Strict anti-fabrication stock calculation:
  // If inventory failed or variant not found in inventory: null (unknown/unconfirmed stock)
  // If variant found: use availableQuantity
  const hasInventoryData = !inventoryError && currentInventory !== null && currentInventory !== undefined;
  const availableStock = hasInventoryData ? currentInventory.availableQuantity : null;
  const isOutOfStock = availableStock !== null && availableStock <= 0;
  const isStockAvailable = availableStock !== null && availableStock > 0;

  // Prices
  const currentPrice = Number(selectedVariant?.price || product.price);
  const currentCompareAtPrice = selectedVariant?.compareAtPrice
    ? Number(selectedVariant.compareAtPrice)
    : product.compareAtPrice
      ? Number(product.compareAtPrice)
      : null;

  const discountPercent =
    currentCompareAtPrice && currentCompareAtPrice > currentPrice
      ? Math.round(((currentCompareAtPrice - currentPrice) / currentCompareAtPrice) * 100)
      : 0;

  const handleVariantChange = (v: ProductVariant) => {
    setSelectedVariant(v);
    setQuantity(1);
    setIsAddedSuccess(false);
  };

  const handleQuantityDecrease = () => {
    if (quantity > 1) {
      setQuantity((q) => q - 1);
    }
  };

  const handleQuantityIncrease = () => {
    if (availableStock !== null && quantity < availableStock) {
      setQuantity((q) => q + 1);
    } else if (availableStock === null) {
      setQuantity((q) => q + 1);
    }
  };

  const handleAddToCart = () => {
    if (!selectedVariant || isOutOfStock || !hasInventoryData) return;

    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      sku: selectedVariant.sku,
      packageSize: selectedVariant.packageSize,
      price: currentPrice,
      quantity: quantity,
      imageUrl: activeImageUrl || primaryImage?.url,
    });

    setIsAddedSuccess(true);
    setTimeout(() => setIsAddedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-gray-500">
        <Link href="/" className="hover:text-primary-700 transition-colors">
          Trang chủ
        </Link>
        <span>/</span>
        <Link href="/san-pham" className="hover:text-primary-700 transition-colors">
          Sản phẩm
        </Link>
        {product.category && (
          <>
            <span>/</span>
            <Link
              href={`/danh-muc/${product.category.slug}`}
              className="hover:text-primary-700 transition-colors"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-gray-900 font-medium truncate max-w-xs sm:max-w-sm">
          {product.name}
        </span>
      </nav>

      {/* Main Product Showcase Box */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* Left Column: MinIO Real Image Gallery */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Main Visual Frame */}
          <div className="relative aspect-square w-full rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center p-4">
            {activeImageUrl ? (
              <img
                src={activeImageUrl}
                alt={product.name}
                className="w-full h-full object-contain transition-transform duration-300 hover:scale-105"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400 space-y-2">
                <Package className="h-16 w-16 text-gray-300" />
                <span className="text-xs">Chưa có ảnh sản phẩm</span>
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {product.featured && (
                <Badge variant="secondary" className="text-[10px] shadow-sm">
                  ★ Nổi bật vụ mùa
                </Badge>
              )}
              {discountPercent > 0 && (
                <Badge variant="destructive" className="text-[10px] shadow-sm">
                  Giảm {discountPercent}%
                </Badge>
              )}
            </div>
          </div>

          {/* Thumbnail Selectors (Real images from ProductImage) */}
          {images.length > 1 && (
            <div className="flex items-center space-x-3 overflow-x-auto pb-2">
              {images.map((img) => {
                const isActive = activeImageUrl === img.url;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImageUrl(img.url)}
                    className={`relative flex-shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden transition-all bg-gray-50 p-1 ${
                      isActive
                        ? 'border-primary-600 ring-2 ring-primary-100 shadow-sm'
                        : 'border-gray-200 opacity-70 hover:opacity-100 hover:border-gray-400'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.altText || product.name}
                      className="w-full h-full object-contain"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Guarantee Highlights */}
          <div className="pt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
            <div className="flex items-center space-x-1.5 p-2 rounded-lg bg-gray-50 border border-gray-100">
              <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>Chính hãng 100%</span>
            </div>
            <div className="flex items-center space-x-1.5 p-2 rounded-lg bg-gray-50 border border-gray-100">
              <Package className="h-4 w-4 text-primary-600 flex-shrink-0" />
              <span>Giao hàng tận nơi</span>
            </div>
          </div>
        </div>

        {/* Right Column: Product Info, Variant Selector, Stock, Action */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Brand & Category badges */}
            <div className="flex flex-wrap items-center gap-2">
              {product.brand && (
                <Link
                  href={`/thuong-hieu/${product.brand.slug}`}
                  className="text-xs font-bold text-primary-700 hover:text-primary-800 uppercase tracking-wider transition-colors"
                >
                  {product.brand.name}
                </Link>
              )}
              {product.brand && product.category && (
                <span className="text-gray-300">•</span>
              )}
              {product.category && (
                <Link
                  href={`/danh-muc/${product.category.slug}`}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {product.category.name}
                </Link>
              )}
            </div>

            {/* Product Title */}
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-snug">
              {product.name}
            </h1>

            {/* SKU and Origin Meta */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <div>
                SKU: <strong className="text-gray-800">{selectedVariant?.sku || product.sku}</strong>
              </div>
              <span>•</span>
              <div>
                Xuất xứ: <strong className="text-gray-800">{product.origin || 'Việt Nam'}</strong>
              </div>
              <span>•</span>
              <div>
                Nhà sản xuất: <strong className="text-gray-800">{product.manufacturer || 'Chính hãng'}</strong>
              </div>
            </div>

            {/* Short Description */}
            {product.shortDescription && (
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                {product.shortDescription}
              </p>
            )}

            {/* Price Box */}
            <div className="p-4 bg-primary-50/50 rounded-xl border border-primary-100 flex flex-wrap items-baseline gap-3">
              <div className="text-3xl font-black text-primary-800">
                {formatCurrencyVND(currentPrice)}
              </div>
              {currentCompareAtPrice && currentCompareAtPrice > currentPrice && (
                <div className="text-sm text-gray-400 line-through">
                  {formatCurrencyVND(currentCompareAtPrice)}
                </div>
              )}
              <span className="text-xs text-gray-500 font-medium">
                / {selectedVariant?.packageSize || 'Đơn vị'} (Đã gồm thuế VAT)
              </span>
            </div>

            {/* Real Stock Status (Anti-fabrication from Inventory Service) */}
            <div className="p-3 rounded-xl border text-xs">
              {isInventoryLoading ? (
                <div className="flex items-center space-x-2 text-gray-500">
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-primary-600 border-t-transparent rounded-full" />
                  <span>Đang kiểm tra tồn kho trực tuyến tại hệ thống kho...</span>
                </div>
              ) : inventoryError || !hasInventoryData ? (
                <div className="flex items-center space-x-2 text-amber-700 bg-amber-50/50 p-1 rounded">
                  <HelpCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <div>
                    <strong>Chưa có thông tin kho / Liên hệ đại lý</strong>
                    <div className="text-[11px] text-amber-600 font-normal">
                      Vui lòng liên hệ tổng đài 1800 6868 để xác nhận số lượng tồn khả dụng cho quy cách này.
                    </div>
                  </div>
                </div>
              ) : isOutOfStock ? (
                <div className="flex items-center space-x-2 text-red-700 bg-red-50/50 p-1 rounded">
                  <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <div>
                    <strong className="font-semibold">Tạm thời hết hàng tại kho</strong>
                    <div className="text-[11px] text-red-600 font-normal">
                      Sản phẩm quy cách này hiện đã hết hàng khả dụng trong kho.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-emerald-800 bg-emerald-50/50 p-1 rounded">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <strong className="font-semibold">Còn hàng trong kho</strong>
                    <div className="text-[11px] text-emerald-700 font-normal">
                      Hiện có <strong>{availableStock}</strong> {selectedVariant?.unit || 'bao/gói'} sẵn sàng xuất kho và vận chuyển.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Variant Selector */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Quy Cách Đóng Gói:
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {product.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    const vInv = inventoryList.find((i) => i.variantId === v.id);
                    const vStock = vInv ? vInv.availableQuantity : null;
                    const isSoldOut = vStock !== null && vStock <= 0;

                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleVariantChange(v)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left flex flex-col ${
                          isSelected
                            ? 'border-primary-600 bg-primary-50 text-primary-900 shadow-sm ring-2 ring-primary-500/20'
                            : isSoldOut
                              ? 'border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-gray-400'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300'
                        }`}
                      >
                        <span className="font-bold">{v.packageSize}</span>
                        <span className="text-[11px] font-normal text-gray-500">
                          {formatCurrencyVND(Number(v.price))}
                          {isSoldOut && ' (Hết hàng)'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Selector & Add To Cart Button */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-4">
                <label className="text-xs font-bold text-gray-700 uppercase">Số lượng:</label>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={handleQuantityDecrease}
                    disabled={!isStockAvailable || quantity <= 1}
                    className="p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Giảm số lượng"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={availableStock || 9999}
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (isNaN(val) || val < 1) {
                        setQuantity(1);
                      } else if (availableStock !== null && val > availableStock) {
                        setQuantity(availableStock);
                      } else {
                        setQuantity(val);
                      }
                    }}
                    disabled={!isStockAvailable}
                    className="w-14 text-center text-xs font-bold py-1.5 focus:outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={handleQuantityIncrease}
                    disabled={!isStockAvailable || (availableStock !== null && quantity >= availableStock)}
                    className="p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Tăng số lượng"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {isStockAvailable && (
                  <span className="text-xs text-gray-500">
                    (Tối đa: {availableStock} {selectedVariant?.unit || 'đơn vị'})
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  size="lg"
                  disabled={!isStockAvailable}
                  onClick={handleAddToCart}
                  className={`flex-1 justify-center space-x-2 font-bold shadow-md transition-all ${
                    isAddedSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                  }`}
                >
                  {isAddedSuccess ? (
                    <>
                      <Check className="h-5 w-5" />
                      <span>Đã thêm vào giỏ hàng!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-5 w-5" />
                      <span>
                        {isOutOfStock
                          ? 'Tạm hết hàng'
                          : !hasInventoryData
                            ? 'Chưa thể đặt hàng'
                            : 'Thêm vào giỏ hàng'}
                      </span>
                    </>
                  )}
                </Button>
                <Link href="/san-pham" className="sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full justify-center">
                    Xem sản phẩm khác
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Tabs Section: Mô tả, Thành phần, Hướng dẫn sử dụng, Bảo quản, Cảnh báo */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="border-b border-gray-200 bg-gray-50 flex overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('description')}
            className={`px-5 py-3.5 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'description'
                ? 'border-primary-600 text-primary-700 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <FileText className="h-4 w-4 text-primary-600" />
            <span>Mô Tả Chi Tiết</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('composition')}
            className={`px-5 py-3.5 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'composition'
                ? 'border-primary-600 text-primary-700 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <Layers className="h-4 w-4 text-primary-600" />
            <span>Thành Phần Định Lượng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('usage')}
            className={`px-5 py-3.5 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'usage'
                ? 'border-primary-600 text-primary-700 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <Sprout className="h-4 w-4 text-harvest-500" />
            <span>Hướng Dẫn Sử Dụng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`px-5 py-3.5 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'storage'
                ? 'border-primary-600 text-primary-700 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <Package className="h-4 w-4 text-blue-600" />
            <span>Quy Cách & Bảo Quản</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('warning')}
            className={`px-5 py-3.5 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'warning'
                ? 'border-amber-600 text-amber-800 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Cảnh Báo An Toàn</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 sm:p-8">
          {activeTab === 'description' && (
            <div className="space-y-4 max-w-4xl">
              <h3 className="text-base font-bold text-gray-900">
                Thông tin giới thiệu về {product.name}
              </h3>
              <div className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-line space-y-3">
                {product.description ? (
                  <p>{product.description}</p>
                ) : (
                  <p>{product.shortDescription || 'Đang cập nhật mô tả chi tiết sản phẩm.'}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'composition' && (
            <div className="space-y-4 max-w-4xl">
              <h3 className="text-base font-bold text-gray-900">
                Chỉ tiêu hàm lượng dinh dưỡng công bố
              </h3>
              {product.composition ? (
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 font-mono text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                  {product.composition}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Xem thông tin chi tiết trên bao bì đóng gói của nhà sản xuất.
                </p>
              )}
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="space-y-4 max-w-4xl">
              <h3 className="text-base font-bold text-gray-900">
                Quy trình bón phân theo giai đoạn mùa vụ
              </h3>
              {product.usageInstructions ? (
                <div className="p-4 rounded-xl bg-primary-50/30 border border-primary-100 text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                  {product.usageInstructions}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Bón theo khuyến nghị của cán bộ nông nghiệp địa phương và hướng dẫn trên bao bì.
                </p>
              )}
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4 max-w-4xl">
              <h3 className="text-base font-bold text-gray-900">
                Hướng dẫn bảo quản phân bón đúng cách
              </h3>
              <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 text-xs sm:text-sm text-blue-900 leading-relaxed whitespace-pre-line">
                {product.storageInstructions ||
                  'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và nơi có độ ẩm cao. Để xa tầm tay trẻ em và nguồn thực phẩm, nguồn nước sinh hoạt.'}
              </div>
            </div>
          )}

          {activeTab === 'warning' && (
            <div className="space-y-4 max-w-4xl">
              <h3 className="text-base font-bold text-amber-900">
                Khuyến cáo an toàn lao động nông nghiệp
              </h3>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-900 leading-relaxed whitespace-pre-line">
                {product.warningInformation ||
                  'Trang bị bảo hộ lao động (găng tay, khẩu trang, kính bảo hộ) khi pha chế và bón phân. Rửa sạch tay chân sau khi thao tác. Không chăn thả gia súc tại khu vực vừa bón phân.'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agricultural Attributes Section */}
      {product.agriculturalAttrs && product.agriculturalAttrs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Sprout className="h-5 w-5 text-primary-600" />
            <h3 className="text-base font-bold text-gray-900">
              Đặc Tính Kỹ Thuật Nông Nghiệp Học
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {product.agriculturalAttrs.map((attr) => {
              const label =
                attr.attributeType === 'CROP'
                  ? 'Cây trồng phù hợp'
                  : attr.attributeType === 'GROWTH_STAGE'
                    ? 'Giai đoạn sinh trưởng'
                    : attr.attributeType === 'APPLICATION_METHOD'
                      ? 'Phương thức bón'
                      : 'Loại dinh dưỡng';

              const Icon =
                attr.attributeType === 'CROP'
                  ? Sprout
                  : attr.attributeType === 'GROWTH_STAGE'
                    ? Calendar
                    : attr.attributeType === 'APPLICATION_METHOD'
                      ? Compass
                      : Layers;

              return (
                <div
                  key={attr.id}
                  className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center space-x-1.5 text-xs text-gray-500 font-medium">
                    <Icon className="h-4 w-4 text-primary-600" />
                    <span>{label}</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {attr.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
