'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Ticket,
  PlusCircle,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Percent,
  Coins,
  Truck,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent } from '../../../components/ui/card';
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

interface CouponItem {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  value: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  startDate: string;
  endDate: string;
  usageLimit: number | null;
  usedCount: number;
  usagePerCustomer: number;
  enabled: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'DISABLED' | 'OUT_OF_LIMIT';
  actualUsagesCount: number;
  createdAt: string;
}

const couponSchema = z.object({
  code: z
    .string()
    .min(3, 'Mã giảm giá tối thiểu 3 ký tự')
    .max(50, 'Mã không quá 50 ký tự')
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ chứa chữ cái, số, dấu gạch nối hoặc gạch dưới'),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value: z.coerce.number().min(0, 'Mức giảm không thể âm'),
  minOrderAmount: z.coerce.number().min(0, 'Đơn tối thiểu không thể âm').default(0),
  maxDiscountAmount: z.coerce.number().optional().nullable(),
  startDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu'),
  endDate: z.string().min(1, 'Vui lòng chọn ngày kết thúc'),
  usageLimit: z.coerce.number().optional().nullable(),
  usagePerCustomer: z.coerce.number().min(1, 'Tối thiểu 1 lần/khách').default(1),
  enabled: z.boolean().default(true),
});

type CouponFormValues = z.infer<typeof couponSchema>;

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterEnabled, setFilterEnabled] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: '',
      description: '',
      type: 'PERCENTAGE',
      value: 10,
      minOrderAmount: 0,
      maxDiscountAmount: null,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      usageLimit: 100,
      usagePerCustomer: 1,
      enabled: true,
    },
  });

  const selectedType = watch('type');

  const fetchCoupons = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '15');
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      if (filterEnabled !== 'all') {
        params.append('enabled', filterEnabled === 'active' ? 'true' : 'false');
      }

      const res = await apiClient<{
        items: CouponItem[];
        total: number;
        totalPages: number;
      }>(`/coupons/admin?${params.toString()}`);
      if (res.success) {
        setCoupons(res.data.items || []);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setFeedback({
          type: 'error',
          message: res.error?.message || 'Không thể tải danh sách mã giảm giá từ server.',
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể tải danh sách mã giảm giá từ server.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, filterEnabled]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const openCreateModal = () => {
    setEditingCoupon(null);
    reset({
      code: '',
      description: '',
      type: 'PERCENTAGE',
      value: 10,
      minOrderAmount: 0,
      maxDiscountAmount: null,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      usageLimit: 100,
      usagePerCustomer: 1,
      enabled: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (c: CouponItem) => {
    setEditingCoupon(c);
    reset({
      code: c.code,
      description: c.description || '',
      type: c.type,
      value: c.value,
      minOrderAmount: c.minOrderAmount,
      maxDiscountAmount: c.maxDiscountAmount || undefined,
      startDate: c.startDate ? c.startDate.split('T')[0] : '',
      endDate: c.endDate ? c.endDate.split('T')[0] : '',
      usageLimit: c.usageLimit || undefined,
      usagePerCustomer: c.usagePerCustomer,
      enabled: c.enabled,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (values: CouponFormValues) => {
    try {
      setIsSubmitting(true);
      setFeedback(null);

      const payload = {
        ...values,
        code: values.code.trim().toUpperCase(),
        maxDiscountAmount: values.maxDiscountAmount || null,
        usageLimit: values.usageLimit || null,
      };

      if (editingCoupon) {
        await apiClient(`/coupons/${editingCoupon.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', message: `Đã cập nhật thành công mã "${payload.code}"` });
      } else {
        await apiClient('/coupons', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', message: `Đã tạo thành công mã giảm giá "${payload.code}"` });
      }

      setIsModalOpen(false);
      fetchCoupons();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Thao tác lưu mã giảm giá thất bại.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (c: CouponItem) => {
    try {
      await apiClient(`/coupons/${c.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !c.enabled }),
      });
      setFeedback({
        type: 'success',
        message: `Đã ${c.enabled ? 'tạm ngưng' : 'kích hoạt'} mã "${c.code}"`,
      });
      fetchCoupons();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể đổi trạng thái mã giảm giá.',
      });
    }
  };

  const handleDelete = async (c: CouponItem) => {
    if (!confirm(`Bạn có chắc muốn xóa hoặc vô hiệu hóa mã "${c.code}"?`)) return;
    try {
      await apiClient(`/coupons/${c.id}`, {
        method: 'DELETE',
      });
      setFeedback({
        type: 'success',
        message: `Đã xử lý xóa/vô hiệu hóa mã "${c.code}" thành công.`,
      });
      fetchCoupons();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Lỗi khi xóa mã giảm giá.',
      });
    }
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(num);
  };

  const formatDate = (iso: string) => {
    if (!iso) return '---';
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Quản Lý Mã Giảm Giá & Ưu Đãi
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Thiết lập các chương trình khuyến mãi, voucher nông vụ và chiết khấu cho khách hàng
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCoupons()}
            disabled={isLoading}
            className="text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
          <Button
            onClick={openCreateModal}
            size="sm"
            className="text-xs h-9 bg-primary-600 hover:bg-primary-700 text-white font-medium"
          >
            <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
            Tạo Mã Ưu Đãi Mới
          </Button>
        </div>
      </div>

      {/* Alert feedback */}
      {feedback && (
        <Alert
          variant={feedback.type === 'error' ? 'destructive' : 'default'}
          className="py-3 text-xs"
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <AlertDescription className="ml-2 font-medium">{feedback.message}</AlertDescription>
        </Alert>
      )}

      {/* Filter Bar */}
      <Card className="border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm theo mã coupon hoặc mô tả..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-9 text-xs h-9"
              />
            </div>
            <div className="w-full sm:w-48">
              <select
                value={filterEnabled}
                onChange={(e) => {
                  setFilterEnabled(e.target.value);
                  setPage(1);
                }}
                aria-label="Lọc theo trạng thái kích hoạt"
                className="w-full h-9 px-3 rounded-md border border-gray-300 bg-white text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang kích hoạt</option>
                <option value="disabled">Đã tạm ngưng</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Section */}
      <Card className="border-gray-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 border-b border-gray-200">
              <TableRow>
                <TableHead className="text-[11px] font-bold text-gray-600 uppercase tracking-wider py-3">
                  Mã & Mô Tả
                </TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 uppercase tracking-wider py-3">
                  Loại Giảm
                </TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 uppercase tracking-wider py-3">
                  Giá Trị & Điều Kiện
                </TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 uppercase tracking-wider py-3">
                  Thời Gian Hiệu Lực
                </TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 uppercase tracking-wider py-3 text-center">
                  Lượt Dùng
                </TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 uppercase tracking-wider py-3 text-center">
                  Trạng Thái
                </TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 uppercase tracking-wider py-3 text-right">
                  Thao Tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="py-4">
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : coupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-gray-500 text-xs">
                    Không tìm thấy mã giảm giá nào phù hợp với bộ lọc.
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((c) => (
                  <TableRow key={c.id} className="hover:bg-gray-50/80 transition-colors">
                    <TableCell className="py-3 font-medium">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-primary-700 text-xs tracking-wider">
                          {c.code}
                        </span>
                        <span className="text-[11px] text-gray-500 truncate max-w-xs mt-0.5">
                          {c.description || 'Không có mô tả'}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3">
                      {c.type === 'PERCENTAGE' && (
                        <Badge variant="outline" className="text-[10px] text-blue-700 bg-blue-50 border-blue-200">
                          <Percent className="h-2.5 w-2.5 mr-1" />
                          Phần trăm (%)
                        </Badge>
                      )}
                      {c.type === 'FIXED_AMOUNT' && (
                        <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                          <Coins className="h-2.5 w-2.5 mr-1" />
                          Số tiền cố định
                        </Badge>
                      )}
                      {c.type === 'FREE_SHIPPING' && (
                        <Badge variant="outline" className="text-[10px] text-purple-700 bg-purple-50 border-purple-200">
                          <Truck className="h-2.5 w-2.5 mr-1" />
                          Freeship
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="py-3 text-xs">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">
                          {c.type === 'PERCENTAGE'
                            ? `Giảm ${c.value}%`
                            : c.type === 'FIXED_AMOUNT'
                            ? `Giảm ${formatVND(c.value)}`
                            : 'Miễn phí vận chuyển'}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Đơn tối thiểu: {c.minOrderAmount > 0 ? formatVND(c.minOrderAmount) : 'Không yêu cầu'}
                        </span>
                        {c.maxDiscountAmount && c.type === 'PERCENTAGE' && (
                          <span className="text-[10px] text-amber-600 font-medium">
                            Giảm tối đa: {formatVND(c.maxDiscountAmount)}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-xs text-gray-600">
                      <div className="flex flex-col text-[11px]">
                        <span>Từ: {formatDate(c.startDate)}</span>
                        <span>Đến: {formatDate(c.endDate)}</span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-center text-xs">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-gray-800">
                          {c.usedCount} / {c.usageLimit !== null ? c.usageLimit : '∞'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          ({c.usagePerCustomer} lần/khách)
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-center">
                      {c.status === 'ACTIVE' && (
                        <Badge variant="success" className="text-[10px] px-2 py-0.5">
                          Đang hiệu lực
                        </Badge>
                      )}
                      {c.status === 'EXPIRED' && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-gray-600 bg-gray-100">
                          Hết hạn
                        </Badge>
                      )}
                      {c.status === 'DISABLED' && (
                        <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
                          Tạm ngưng
                        </Badge>
                      )}
                      {c.status === 'OUT_OF_LIMIT' && (
                        <Badge variant="warning" className="text-[10px] px-2 py-0.5">
                          Hết lượt
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="py-3 text-right space-x-1">
                      <button
                        onClick={() => toggleStatus(c)}
                        title={c.enabled ? 'Tạm ngưng mã' : 'Kích hoạt mã'}
                        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
                          c.enabled ? 'text-emerald-600' : 'text-gray-400'
                        }`}
                      >
                        {c.enabled ? (
                          <ToggleRight className="h-5 w-5" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditModal(c)}
                        title="Chỉnh sửa"
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        title="Xóa mã"
                        className="p-1.5 rounded hover:bg-red-50 text-red-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 bg-gray-50">
            <div>Trang {page} / {totalPages}</div>
            <div className="space-x-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 text-xs"
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 text-xs"
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal Create / Edit Coupon */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center space-x-2">
                <Ticket className="h-5 w-5 text-primary-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  {editingCoupon ? 'Chỉnh Sửa Mã Giảm Giá' : 'Tạo Mã Giảm Giá Ưu Đãi Mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1">
                  <label className="block text-gray-700 font-semibold mb-1">
                    Mã Coupon *
                  </label>
                  <Input
                    {...register('code')}
                    placeholder="VD: PHANBON10, MUAVU"
                    className="font-mono uppercase font-bold text-xs h-9"
                  />
                  {errors.code && (
                    <p className="text-red-500 text-[10px] mt-1">{errors.code.message}</p>
                  )}
                </div>

                <div className="col-span-1">
                  <label className="block text-gray-700 font-semibold mb-1">
                    Loại Ưu Đãi *
                  </label>
                  <select
                    {...register('type')}
                    aria-label="Loại ưu đãi mã giảm giá"
                    className="w-full h-9 px-2.5 rounded-md border border-gray-300 bg-white text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="PERCENTAGE">Phần trăm (%)</option>
                    <option value="FIXED_AMOUNT">Số tiền cố định (VND)</option>
                    <option value="FREE_SHIPPING">Miễn phí giao hàng</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Mô Tả Chương Trình
                </label>
                <Input
                  {...register('description')}
                  placeholder="VD: Ưu đãi đầu mùa vụ phân bón NPK..."
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    {selectedType === 'PERCENTAGE'
                      ? 'Mức giảm (%) *'
                      : selectedType === 'FIXED_AMOUNT'
                      ? 'Số tiền giảm (VND) *'
                      : 'Giá trị (0 VND)'}
                  </label>
                  <Input
                    type="number"
                    disabled={selectedType === 'FREE_SHIPPING'}
                    {...register('value')}
                    placeholder={selectedType === 'PERCENTAGE' ? '10' : '50000'}
                    className="text-xs h-9 font-semibold"
                  />
                  {errors.value && (
                    <p className="text-red-500 text-[10px] mt-1">{errors.value.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Đơn Tối Thiểu (VND)
                  </label>
                  <Input
                    type="number"
                    {...register('minOrderAmount')}
                    placeholder="VD: 500000"
                    className="text-xs h-9"
                  />
                  {errors.minOrderAmount && (
                    <p className="text-red-500 text-[10px] mt-1">{errors.minOrderAmount.message}</p>
                  )}
                </div>
              </div>

              {selectedType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Mức Giảm Tối Đa (VND - Để trống nếu không giới hạn)
                  </label>
                  <Input
                    type="number"
                    {...register('maxDiscountAmount')}
                    placeholder="VD: 200000"
                    className="text-xs h-9"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Bắt Đầu Từ *
                  </label>
                  <Input
                    type="date"
                    {...register('startDate')}
                    className="text-xs h-9"
                  />
                  {errors.startDate && (
                    <p className="text-red-500 text-[10px] mt-1">{errors.startDate.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Kết Thúc Lúc *
                  </label>
                  <Input
                    type="date"
                    {...register('endDate')}
                    className="text-xs h-9"
                  />
                  {errors.endDate && (
                    <p className="text-red-500 text-[10px] mt-1">{errors.endDate.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Tổng Lượt Dùng Toàn Sàn
                  </label>
                  <Input
                    type="number"
                    {...register('usageLimit')}
                    placeholder="VD: 500 (Để trống = vô hạn)"
                    className="text-xs h-9"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Lượt Dùng Mỗi Khách *
                  </label>
                  <Input
                    type="number"
                    {...register('usagePerCustomer')}
                    placeholder="1"
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
                <input
                  type="checkbox"
                  id="enabled"
                  {...register('enabled')}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                />
                <label htmlFor="enabled" className="text-gray-700 font-semibold cursor-pointer">
                  Kích hoạt mã ngay sau khi lưu
                </label>
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs h-9"
                >
                  Hủy Bỏ
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="text-xs h-9 bg-primary-600 hover:bg-primary-700 text-white font-semibold"
                >
                  {isSubmitting ? 'Đang lưu...' : editingCoupon ? 'Cập Nhật' : 'Tạo Coupon'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
