'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, RefreshCw, ExternalLink, Sparkles, Plus } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Product } from '../../../types/index';
import { formatCurrencyVND } from '../../../lib/formatters';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../components/ui/table';
import CreateProductModal from './create-product-modal';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient<{ items: Product[]; total: number }>(
        '/products?page=1&limit=50',
      );
      if (res.success && res.data) {
        setProducts(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
            <Package className="h-6 w-6 text-primary-600" />
            <span>Danh Mục & Sản Phẩm Lưu Hành</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Tổng cộng <strong>{total}</strong> mặt hàng phân bón đã được chuẩn hóa và số hóa vào hệ thống.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadProducts}
            disabled={isLoading}
            className="space-x-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white space-x-1.5 text-xs shadow-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm Sản Phẩm Mới</span>
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã SKU</TableHead>
                  <TableHead>Tên Sản Phẩm</TableHead>
                  <TableHead>Thương Hiệu</TableHead>
                  <TableHead>Danh Mục</TableHead>
                  <TableHead className="text-right">Giá Tham Chiếu</TableHead>
                  <TableHead className="text-center">Trạng Thái</TableHead>
                  <TableHead className="text-right">Thao Tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-semibold text-gray-700">
                      {p.sku}
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-xs text-gray-900 line-clamp-1">{p.name}</div>
                      {p.bestSeller && (
                        <span className="inline-flex items-center text-[10px] font-semibold text-harvest-600 space-x-1">
                          <Sparkles className="h-3 w-3" />
                          <span>Bán chạy vụ mùa</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {p.brand?.name || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {p.category?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-primary-800">
                      {formatCurrencyVND(p.price)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="success" className="text-[10px]">
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/san-pham/${p.slug}`}
                        target="_blank"
                        className="inline-flex items-center text-xs text-primary-600 hover:text-primary-800 font-medium"
                      >
                        <span>Xem web</span>
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Thêm Sản Phẩm Mới */}
      <CreateProductModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadProducts}
      />
    </div>
  );
}
