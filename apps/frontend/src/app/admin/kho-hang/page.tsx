'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Boxes,
  PlusCircle,
  History,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { formatDateTimeVN } from '../../../lib/formatters';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../components/ui/table';

interface InventoryItem {
  id: string;
  productId: string;
  variantId: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  updatedAt: string;
}

interface InventoryMovement {
  id: string;
  productId: string;
  variantId: string;
  type: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  reason: string;
  performedBy: string;
  createdAt: string;
}

const adjustSchema = z.object({
  productId: z.string().min(1, 'Vui lòng nhập Product ID'),
  variantId: z.string().min(1, 'Vui lòng nhập Variant ID'),
  quantityChange: z.coerce.number().int('Số lượng phải là số nguyên').refine((val) => val !== 0, {
    message: 'Số lượng thay đổi phải khác 0 (Dương: nhập thêm, Âm: hao hụt/xuất hủy)',
  }),
  reason: z.string().min(5, 'Lý do điều chỉnh kho bắt buộc tối thiểu 5 ký tự'),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
});

type AdjustFormValues = z.infer<typeof adjustSchema>;

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: {
      productId: '',
      variantId: '',
      quantityChange: 1,
      reason: '',
      referenceType: 'MANUAL_AUDIT',
      referenceId: '',
    },
  });

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await apiClient<{
        items: InventoryItem[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/inventory?${params.toString()}`, { requireAuth: true });

      if (res.success && res.data) {
        setItems(res.data.items || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }

      // Load 10 biến động kho gần nhất
      const moveRes = await apiClient<InventoryMovement[]>(
        '/inventory/movements?limit=10',
        { requireAuth: true },
      );
      if (moveRes.success && moveRes.data) {
        setMovements(Array.isArray(moveRes.data) ? moveRes.data : []);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const openAdjustModal = (item?: InventoryItem) => {
    setFeedback(null);
    if (item) {
      setValue('productId', item.productId);
      setValue('variantId', item.variantId);
      setValue('quantityChange', 10);
      setValue('reason', 'Kiểm kê định kỳ - Điều chỉnh kho');
    } else {
      reset({
        productId: '',
        variantId: '',
        quantityChange: 1,
        reason: '',
        referenceType: 'MANUAL_AUDIT',
        referenceId: '',
      });
    }
    setIsModalOpen(true);
  };

  const onSubmitAdjust = async (values: AdjustFormValues) => {
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await apiClient<{
        success: boolean;
        message: string;
        inventory: InventoryItem;
      }>('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify(values),
        requireAuth: true,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Điều chỉnh tồn kho thành công! Tồn vật lý mới: ${res.data?.inventory?.stockQuantity}, Khả dụng: ${res.data?.inventory?.availableQuantity}`,
        });
        reset();
        await loadInventory();
        setTimeout(() => setIsModalOpen(false), 1500);
      } else {
        setFeedback({
          type: 'error',
          message: res.error?.message || 'Không thể điều chỉnh tồn kho',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Lỗi kết nối máy chủ',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
            <Boxes className="h-6 w-6 text-primary-600" />
            <span>Quản Lý Tồn Kho & Kiểm Kê</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Theo dõi chính xác 3 chỉ số tồn: <strong>Tồn Vật Lý (Stock)</strong>, <strong>Tạm Giữ (Reserved)</strong> và <strong>Khả Dụng (Available)</strong> chống oversell.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadInventory()}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
          <Button
            size="sm"
            onClick={() => openAdjustModal()}
            className="text-xs space-x-1.5 shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Điều chỉnh kiểm kê</span>
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm theo Product ID hoặc Variant ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-9 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Inventory Items Table */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b border-gray-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-gray-900">
              Danh Sách Tồn Kho Phân Bón
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Tổng cộng <strong>{total}</strong> dòng tồn kho đang quản lý
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70">
                <TableHead className="text-xs font-semibold">Product ID</TableHead>
                <TableHead className="text-xs font-semibold">Variant ID</TableHead>
                <TableHead className="text-xs font-semibold text-center">Tồn Vật Lý</TableHead>
                <TableHead className="text-xs font-semibold text-center">Tạm Giữ (Reserved)</TableHead>
                <TableHead className="text-xs font-semibold text-center">Khả Dụng (Available)</TableHead>
                <TableHead className="text-xs font-semibold text-center">Định Mức Cảnh Báo</TableHead>
                <TableHead className="text-xs font-semibold text-center">Trạng Thái</TableHead>
                <TableHead className="text-xs font-semibold text-center">Thao Tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-xs text-gray-500">
                    Chưa có bản ghi tồn kho nào phù hợp.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const isLow = item.availableQuantity <= item.reorderLevel;
                  const isOut = item.availableQuantity <= 0;

                  return (
                    <TableRow key={item.id} className="hover:bg-gray-50/70 transition-colors">
                      <TableCell className="font-mono text-xs font-semibold text-gray-800">
                        {item.productId}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-600">
                        {item.variantId}
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold text-gray-900">
                        {item.stockQuantity}
                      </TableCell>
                      <TableCell className="text-center text-xs font-semibold text-amber-600">
                        {item.reservedQuantity}
                      </TableCell>
                      <TableCell className="text-center text-xs font-black text-emerald-700">
                        {item.availableQuantity}
                      </TableCell>
                      <TableCell className="text-center text-xs text-gray-500">
                        {item.reorderLevel}
                      </TableCell>
                      <TableCell className="text-center">
                        {isOut ? (
                          <Badge variant="destructive">HẾT HÀNG</Badge>
                        ) : isLow ? (
                          <Badge variant="warning">SẮP HẾT</Badge>
                        ) : (
                          <Badge variant="success">ĐỦ HÀNG</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAdjustModal(item)}
                          className="text-xs h-8 px-2.5"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5 mr-1 text-primary-600" />
                          Điều chỉnh
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-500">
                Trang {page} / {totalPages} (Tổng {total} bản ghi)
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  className="text-xs h-8"
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  className="text-xs h-8"
                >
                  Trang sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movements Audit History */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b border-gray-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <History className="h-5 w-5 text-gray-600" />
              <span>Sổ Cái Biến Động Kho Gần Đây (Audit Movements)</span>
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Ghi vết bất biến mọi thay đổi tăng/giảm tồn kho vật lý và tạm giữ
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70">
                <TableHead className="text-xs font-semibold">Thời Gian</TableHead>
                <TableHead className="text-xs font-semibold">Quy Cách (Variant)</TableHead>
                <TableHead className="text-xs font-semibold">Loại Biến Động</TableHead>
                <TableHead className="text-xs font-semibold text-center">Thay Đổi</TableHead>
                <TableHead className="text-xs font-semibold text-center">Tồn Trước → Sau</TableHead>
                <TableHead className="text-xs font-semibold">Lý Do / Chứng Từ</TableHead>
                <TableHead className="text-xs font-semibold">Người Thực Hiện</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-gray-500">
                    Chưa có giao dịch biến động kho nào.
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((m) => (
                  <TableRow key={m.id} className="hover:bg-gray-50/60">
                    <TableCell className="text-[11px] text-gray-500">
                      {formatDateTimeVN(m.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium text-gray-800">
                      {m.variantId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {m.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs font-bold">
                      <span className={m.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-xs text-gray-600">
                      {m.stockBefore} → <strong className="text-gray-900">{m.stockAfter}</strong>
                    </TableCell>
                    <TableCell className="text-xs text-gray-700 italic">
                      {m.reason}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {m.performedBy}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Adjust Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                <SlidersHorizontal className="h-5 w-5 text-primary-600" />
                <span>Điều Chỉnh Kiểm Kê Tồn Kho</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {feedback && (
              <div className="mt-4">
                <Alert variant={feedback.type === 'error' ? 'destructive' : 'default'}>
                  <AlertDescription>{feedback.message}</AlertDescription>
                </Alert>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmitAdjust)} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Product ID <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('productId')}
                  placeholder="Nhập ID sản phẩm..."
                  className="text-xs"
                />
                {errors.productId && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.productId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Variant ID <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('variantId')}
                  placeholder="Nhập ID quy cách đóng gói (variant)..."
                  className="text-xs"
                />
                {errors.variantId && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.variantId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Số lượng thay đổi (+/-) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  {...register('quantityChange')}
                  placeholder="Ví dụ: 10 (nhập thêm) hoặc -5 (hao hụt)"
                  className="text-xs font-bold"
                />
                {errors.quantityChange && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.quantityChange.message}</p>
                )}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Số dương: Nhập thêm kho | Số âm: Hao hụt, hư hại, xuất hủy
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Lý do điều chỉnh (Bắt buộc) <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('reason')}
                  rows={3}
                  placeholder="Nhập lý do chi tiết (tối thiểu 5 ký tự) để phục vụ kiểm toán sổ cái..."
                  className="w-full rounded-md border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-primary-600 focus:outline-none"
                />
                {errors.reason && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.reason.message}</p>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  {isSubmitting ? 'Đang ghi sổ...' : 'Xác nhận điều chỉnh'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
