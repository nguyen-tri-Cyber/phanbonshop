'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Boxes,
  PlusCircle,
  History,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { InventoryItem, InventoryMovement } from '../../../types/index';
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

const adjustSchema = z.object({
  productId: z.string().min(1, 'Vui lòng nhập Product ID'),
  variantId: z.string().min(1, 'Vui lòng nhập Variant ID'),
  quantityChange: z.coerce.number().int('Số lượng phải là số nguyên').refine((val) => val !== 0, {
    message: 'Số lượng thay đổi phải khác 0 (Dương: nhập thêm, Âm: hao hụt)',
  }),
  reason: z.string().min(5, 'Lý do điều chỉnh kho bắt buộc tối thiểu 5 ký tự'),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
});

type AdjustFormValues = z.infer<typeof adjustSchema>;

export default function AdminInventoryPage() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: {
      productId: 'test-product-npk',
      variantId: 'test-variant-npk-101',
      quantityChange: 10,
      reason: 'Nhập kho bổ sung đầu vụ Đông Xuân từ nhà máy Bình Điền',
      referenceType: 'PURCHASE',
      referenceId: 'PN-2026-DX-01',
    },
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const movRes = await apiClient<InventoryMovement[]>(
        '/inventory/movements?limit=15',
        { requireAuth: true },
      );

      if (movRes.success && Array.isArray(movRes.data)) {
        setMovements(movRes.data);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onAdjustSubmit = async (values: AdjustFormValues) => {
    setIsSubmitting(true);
    setFeedback(null);

    const res = await apiClient<{ success: boolean; inventory: InventoryItem }>(
      '/inventory/adjust',
      {
        method: 'POST',
        requireAuth: true,
        body: JSON.stringify(values),
      },
    );

    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Điều chỉnh kho thành công! Tồn kho mới: ${res.data?.inventory?.stockQuantity}, Khả dụng: ${res.data?.inventory?.availableQuantity}`,
      });
      loadData();
    } else {
      setFeedback({
        type: 'error',
        message: res.error?.message || 'Không thể điều chỉnh kho',
      });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
            <Boxes className="h-6 w-6 text-primary-600" />
            <span>Quản Lý Tồn Kho & Kiểm Kê Hàng Hóa</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Điều chỉnh số lượng thực tế có lưu vết bắt buộc, theo dõi hạn mức khả dụng và kiểm kê kho bãi.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isLoading}
          className="space-x-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Làm mới dữ liệu</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Điều chỉnh tồn kho có lý do bắt buộc */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-base flex items-center space-x-2 text-gray-900">
                <PlusCircle className="h-5 w-5 text-primary-600" />
                <span>Phiếu Điều Chỉnh / Nhập Xuất Kho</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {feedback && (
                <Alert variant={feedback.type === 'success' ? 'success' : 'destructive'}>
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>{feedback.message}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit(onAdjustSubmit)} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mã Sản Phẩm (Product ID)
                  </label>
                  <Input {...register('productId')} className="text-xs" />
                  {errors.productId && (
                    <p className="text-[11px] text-red-600 mt-0.5">{errors.productId.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mã Biến Thể Quy Cách (Variant ID)
                  </label>
                  <Input {...register('variantId')} className="text-xs" />
                  {errors.variantId && (
                    <p className="text-[11px] text-red-600 mt-0.5">{errors.variantId.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Số Lượng Thay Đổi (Dương: nhập kho, Âm: hao hụt/xuất)
                  </label>
                  <Input
                    type="number"
                    step="1"
                    {...register('quantityChange')}
                    className="text-xs font-bold text-primary-700"
                  />
                  {errors.quantityChange && (
                    <p className="text-[11px] text-red-600 mt-0.5">{errors.quantityChange.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Lý Do Điều Chỉnh Bắt Buộc (*)
                  </label>
                  <textarea
                    rows={2}
                    {...register('reason')}
                    placeholder="VD: Kiểm kê định kỳ phát hiện rách bao, nhập bổ sung từ nhà máy..."
                    className="w-full rounded-md border border-gray-300 p-2 text-xs focus:outline-none focus:border-primary-600"
                  />
                  {errors.reason && (
                    <p className="text-[11px] text-red-600 mt-0.5">{errors.reason.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Loại chứng từ
                    </label>
                    <Input {...register('referenceType')} placeholder="PURCHASE / AUDIT" className="text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Mã phiếu / Biên bản
                    </label>
                    <Input {...register('referenceId')} placeholder="PN-2026-001" className="text-xs" />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full justify-center space-x-2 font-bold mt-2"
                >
                  <FileCheck className="h-4 w-4" />
                  <span>{isSubmitting ? 'Đang cập nhật kho...' : 'Xác Nhận Điều Chỉnh Kho'}</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Danh sách biến động kho đầy đủ */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center space-x-2 text-gray-900">
                <History className="h-5 w-5 text-primary-600" />
                <span>Sổ Cái Biến Động Kho Bất Biến (Ledger)</span>
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {movements.length} lượt giao dịch
              </Badge>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : movements.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-500">
                  Chưa có giao dịch biến động kho nào.
                </div>
              ) : (
                <div className="max-h-[520px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loại Giao Dịch</TableHead>
                        <TableHead>SL</TableHead>
                        <TableHead>Tồn Kho</TableHead>
                        <TableHead>Lý Do & Chứng Từ</TableHead>
                        <TableHead className="text-right">Thời Gian (VN)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            <Badge
                              variant={
                                m.type === 'PURCHASE'
                                  ? 'success'
                                  : m.type === 'RESERVATION'
                                    ? 'warning'
                                    : m.type === 'SALE'
                                      ? 'default'
                                      : 'outline'
                              }
                              className="text-[10px]"
                            >
                              {m.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-xs">{m.quantity}</TableCell>
                          <TableCell className="text-xs font-mono text-gray-600">
                            {m.stockBefore} → {m.stockAfter}
                          </TableCell>
                          <TableCell className="text-xs text-gray-600">
                            <div className="font-medium text-gray-800 line-clamp-1">{m.reason}</div>
                            {m.referenceId && (
                              <div className="text-[10px] text-gray-400">
                                {m.referenceType}: {m.referenceId}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-[11px] text-gray-500 whitespace-nowrap">
                            {formatDateTimeVN(m.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
