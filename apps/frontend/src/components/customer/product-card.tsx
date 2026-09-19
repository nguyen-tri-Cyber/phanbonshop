'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { Product } from '../../types/index';
import { formatCurrencyVND } from '../../lib/formatters';
import { useCart } from '../../contexts/cart-context';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();

  const primaryVariant = product.variants?.[0];
  const price = Number(primaryVariant?.price || product.price);
  const comparePrice = Number(primaryVariant?.compareAtPrice || product.compareAtPrice);
  const imageUrl = product.images?.[0]?.url;

  const discountPercent =
    comparePrice && comparePrice > price
      ? Math.round(((comparePrice - price) / comparePrice) * 100)
      : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    addItem({
      variantId: primaryVariant?.id || `var-${product.id}`,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      sku: primaryVariant?.sku || product.sku,
      packageSize: primaryVariant?.packageSize || 'Tiêu chuẩn',
      price: isNaN(price) ? 0 : price,
      quantity: 1,
      imageUrl: imageUrl,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
      {/* Image Frame */}
      <Link
        href={`/san-pham/${product.slug}`}
        className="p-4 bg-gray-50 flex items-center justify-center relative min-h-[190px]"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-36 w-36 object-contain group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="h-24 w-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-3xl font-bold">
            🌱
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {product.bestSeller && (
            <Badge variant="secondary" className="text-[10px]">
              Bán chạy
            </Badge>
          )}
          {product.featured && (
            <Badge variant="default" className="text-[10px] bg-harvest-600 hover:bg-harvest-700">
              Nổi bật
            </Badge>
          )}
          {discountPercent > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              -{discountPercent}%
            </Badge>
          )}
        </div>
      </Link>

      {/* Info Body */}
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

        {/* Price & Action */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-gray-400">Giá bán lẻ:</div>
            <div className="text-base font-black text-primary-800">
              {formatCurrencyVND(price)}
            </div>
            {comparePrice && comparePrice > price && (
              <div className="text-[11px] text-gray-400 line-through">
                {formatCurrencyVND(comparePrice)}
              </div>
            )}
          </div>

          <Button
            size="sm"
            onClick={handleAddToCart}
            className="h-8 px-2.5 space-x-1 text-xs"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Mua</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
