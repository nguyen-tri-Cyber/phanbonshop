'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  ClipboardList,
  Search,
  RefreshCw,
  Eye,
  Clock,
  Truck,
  X,
  CreditCard,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { formatCurrencyVND, formatDateTimeVN } from '../../../lib/formatters';
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

interface OrderItem {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface ShippingAddress {
  recipientName: string;
  phone: string;
  provinceName: string;
  districtName: string;
  wardName: string;
  addressLine: string;
}

interface StatusHistory {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  note: string | null;
  createdAt: string;
}

interface PaymentRecord {
  id: string;
  provider: string;
  method: string;
  amount: number;
  status: string;
  transactionReference: string | null;
  paidAt: string | null;
  auditLogs?: Array<{
    id: string;
    action: string;
    actorId: string;
    actorRole: string;
    note: string | null;
    createdAt: string;
  }>;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  couponCode: string | null;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  statusHistory?: StatusHistory[];
  payments?: PaymentRecord[];
  createdAt: string;
  updatedAt: string;
}

const ALLOWED_NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKING', 'CANCELLED'],
  PACKING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURN_REQUESTED'],
  DELIVERED: ['COMPLETED', 'RETURN_REQUESTED'],
  COMPLETED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED'],
  RETURNED: ['REFUNDED', 'CANCELLED'],
  CANCELLED: ['REFUNDED'],
  REFUNDED: [],
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [statusNote, setStatusNote] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (paymentFilter) params.set('paymentStatus', paymentFilter);

      const res = await apiClient<{
        items: OrderDetail[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/orders/admin?${params.toString()}`, { requireAuth: true });

      if (res.success && res.data) {
        setOrders(res.data.items || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, statusFilter, paymentFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const viewOrderDetail = async (orderId: string) => {
    setActionFeedback(null);
    setStatusNote('');
    try {
      const res = await apiClient<OrderDetail>(`/orders/admin/${orderId}`, {
        requireAuth: true,
      });
      if (res.success && res.data) {
        setSelectedOrder(res.data);
      }
    } catch (err) {
      alert('Không thể tải chi tiết đơn hàng: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const handleUpdateStatus = async (toStatus: string) => {
    if (!selectedOrder) return;
    if (!confirm(`Xác nhận chuyển trạng thái đơn sang "${toStatus}"?`)) return;

    try {
      const res = await apiClient<{ success: boolean; message?: string }>(
        `/orders/${selectedOrder.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: toStatus,
            note: statusNote.trim() || `Cập nhật trạng thái sang ${toStatus}`,
          }),
          requireAuth: true,
        },
      );

      if (res.success) {
        setActionFeedback({ type: 'success', message: `Đã cập nhật trạng thái đơn sang ${toStatus}` });
        await viewOrderDetail(selectedOrder.id);
        fetchOrders();
      } else {
        setActionFeedback({ type: 'error', message: res.error?.message || 'Thao tác thất bại' });
      }
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi hệ thống' });
    }
  };

  const handleConfirmBankPayment = async (paymentId: string) => {
    if (!selectedOrder) return;
    if (!confirm('Xác nhận đã nhận đủ tiền chuyển khoản cho đơn hàng này?')) return;

    try {
      const res = await apiClient<{ success: boolean; message?: string }>(
        `/payments/${paymentId}/confirm`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: selectedOrder.totalAmount,
            note: 'Quản trị viên xác nhận đối soát sao kê ngân hàng thành công',
          }),
          requireAuth: true,
        },
      );

      if (res.success) {
        setActionFeedback({ type: 'success', message: 'Đã xác nhận thanh toán thành công. Đơn hàng tự động chuyển sang CONFIRMED!' });
        await viewOrderDetail(selectedOrder.id);
        fetchOrders();
      } else {
        setActionFeedback({ type: 'error', message: res.error?.message || 'Xác nhận thanh toán thất bại' });
      }
    } catch (err) {
      setActionFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi hệ thống' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'PROCESSING':
        return <Badge variant="success">{status}</Badge>;
      case 'PENDING':
        return <Badge variant="warning">CHỜ XỬ LÝ</Badge>;
      case 'PACKING':
      case 'SHIPPED':
        return <Badge className="bg-blue-600 text-white">{status}</Badge>;
      case 'DELIVERED':
      case 'COMPLETED':
        return <Badge className="bg-emerald-700 text-white">{status}</Badge>;
      case 'CANCELLED':
      case 'REFUNDED':
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
            <ClipboardList className="h-6 w-6 text-primary-600" />
            <span>Quản Lý Đơn Hàng Phân Bón</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Tổng cộng <strong>{total}</strong> đơn hàng đã phát sinh trên sàn thương mại điện tử.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchOrders()}
          disabled={isLoading}
          className="text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      {/* Filters Bar */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm mã đơn, tên khách, SĐT..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-9 text-xs"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-600"
              >
                <option value="">-- Tất cả trạng thái đơn --</option>
                <option value="PENDING">PENDING (Chờ xử lý)</option>
                <option value="CONFIRMED">CONFIRMED (Đã xác nhận)</option>
                <option value="PROCESSING">PROCESSING (Đang chuẩn bị hàng)</option>
                <option value="PACKING">PACKING (Đang đóng gói)</option>
                <option value="SHIPPED">SHIPPED (Đang vận chuyển)</option>
                <option value="DELIVERED">DELIVERED (Đã giao hàng)</option>
                <option value="COMPLETED">COMPLETED (Hoàn tất)</option>
                <option value="CANCELLED">CANCELLED (Đã hủy đơn)</option>
              </select>
            </div>

            {/* Payment Status Filter */}
            <div>
              <select
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-600"
              >
                <option value="">-- Tất cả trạng thái thanh toán --</option>
                <option value="PENDING">PENDING (Chưa thanh toán)</option>
                <option value="PAID">PAID (Đã thanh toán)</option>
                <option value="FAILED">FAILED (Thất bại)</option>
                <option value="CANCELLED">CANCELLED (Đã hủy)</option>
                <option value="REFUNDED">REFUNDED (Đã hoàn tiền)</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-center space-x-2">
              {(searchTerm || statusFilter || paymentFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('');
                    setPaymentFilter('');
                    setPage(1);
                  }}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70">
                <TableHead className="text-xs font-semibold">Mã Đơn Hàng</TableHead>
                <TableHead className="text-xs font-semibold">Người Nhận / SĐT</TableHead>
                <TableHead className="text-xs font-semibold">Trạng Thái Đơn</TableHead>
                <TableHead className="text-xs font-semibold">Thanh Toán</TableHead>
                <TableHead className="text-xs font-semibold text-right">Tổng Tiền</TableHead>
                <TableHead className="text-xs font-semibold text-right">Ngày Đặt</TableHead>
                <TableHead className="text-xs font-semibold text-center">Hành Động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-xs text-gray-500">
                    Không tìm thấy đơn hàng nào phù hợp với điều kiện tìm kiếm.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-gray-50/60 transition-colors">
                    <TableCell className="font-mono text-xs font-bold text-primary-800">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell className="text-xs text-gray-900">
                      <div className="font-medium">{order.shippingAddress?.recipientName || 'Chưa cập nhật'}</div>
                      <div className="text-[11px] text-gray-400">{order.shippingAddress?.phone || ''}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={order.paymentStatus === 'PAID' ? 'success' : 'outline'}
                        className="text-[10px]"
                      >
                        {order.paymentMethod} • {order.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-black text-gray-900 text-right">
                      {formatCurrencyVND(order.totalAmount)}
                    </TableCell>
                    <TableCell className="text-[11px] text-gray-500 text-right">
                      {formatDateTimeVN(order.createdAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewOrderDetail(order.id)}
                        className="text-xs h-8 px-2.5"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1 text-primary-600" />
                        Chi tiết
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-500">
                Trang {page} / {totalPages} (Tổng {total} đơn hàng)
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

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white p-5 border-b border-gray-100 flex items-center justify-between z-10">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-base font-black text-primary-800">
                    {selectedOrder.orderNumber}
                  </span>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Ngày đặt: {formatDateTimeVN(selectedOrder.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {actionFeedback && (
                <Alert variant={actionFeedback.type === 'error' ? 'destructive' : 'default'}>
                  <AlertDescription>{actionFeedback.message}</AlertDescription>
                </Alert>
              )}

              {/* Items List */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Mặt Hàng Đã Đặt
                </h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/70">
                        <TableHead className="text-xs">Sản Phẩm</TableHead>
                        <TableHead className="text-xs">Quy Cách (Variant)</TableHead>
                        <TableHead className="text-xs text-right">Đơn Giá</TableHead>
                        <TableHead className="text-xs text-center">SL</TableHead>
                        <TableHead className="text-xs text-right">Thành Tiền</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs font-medium text-gray-900">
                            {item.productName}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {item.variantName}
                          </TableCell>
                          <TableCell className="text-xs text-right text-gray-700">
                            {formatCurrencyVND(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-xs text-center font-bold text-gray-900">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-xs text-right font-black text-gray-900">
                            {formatCurrencyVND(item.lineTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Price Breakdown */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Tạm tính (Subtotal):</span>
                    <span className="font-semibold">{formatCurrencyVND(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Giảm giá Coupon ({selectedOrder.couponCode || 'Ưu đãi'}):</span>
                      <span className="font-semibold">-{formatCurrencyVND(selectedOrder.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Phí vận chuyển:</span>
                    <span className="font-semibold">{formatCurrencyVND(selectedOrder.shippingFee)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-gray-900 pt-2 border-t border-gray-200">
                    <span>Tổng thanh toán:</span>
                    <span className="text-primary-800 text-base">{formatCurrencyVND(selectedOrder.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center space-x-1.5">
                  <MapPin className="h-4 w-4 text-primary-600" />
                  <span>Địa Chỉ Giao Hàng</span>
                </h3>
                <div className="p-4 rounded-xl border border-gray-200 bg-white text-xs space-y-1">
                  <p className="font-bold text-gray-900 text-sm">
                    {selectedOrder.shippingAddress?.recipientName} • {selectedOrder.shippingAddress?.phone}
                  </p>
                  <p className="text-gray-600">
                    {selectedOrder.shippingAddress?.addressLine}, {selectedOrder.shippingAddress?.wardName}, {selectedOrder.shippingAddress?.districtName}, {selectedOrder.shippingAddress?.provinceName}
                  </p>
                </div>
              </div>

              {/* Payment Info & Bank Confirmation */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center space-x-1.5">
                  <CreditCard className="h-4 w-4 text-primary-600" />
                  <span>Trạng Thái Thanh Toán</span>
                </h3>
                <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-gray-500">Phương thức: </span>
                      <strong className="text-gray-900">{selectedOrder.paymentMethod}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Trạng thái: </span>
                      <Badge variant={selectedOrder.paymentStatus === 'PAID' ? 'success' : 'outline'}>
                        {selectedOrder.paymentStatus}
                      </Badge>
                    </div>
                  </div>

                  {/* Bank Transfer / Cash Confirmation CTA */}
                  {selectedOrder.status !== 'CANCELLED' &&
                    selectedOrder.status !== 'REFUNDED' &&
                    selectedOrder.status !== 'RETURNED' &&
                    selectedOrder.paymentStatus !== 'PAID' &&
                    selectedOrder.paymentStatus !== 'CANCELLED' &&
                    selectedOrder.paymentStatus !== 'REFUNDED' &&
                    selectedOrder.payments &&
                    selectedOrder.payments[0] && (
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-[11px] text-amber-700">
                        Đơn chưa được thanh toán. Sau khi kiểm tra sao kê ngân hàng hoặc thu tiền mặt, hãy xác nhận:
                      </p>
                      <Button
                        size="sm"
                        onClick={() => handleConfirmBankPayment(selectedOrder.payments![0].id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs space-x-1"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Xác Nhận Đã Thu Tiền</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* State Machine Transition Controls */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center space-x-1.5">
                  <Truck className="h-4 w-4 text-primary-600" />
                  <span>Chuyển Trạng Thái Đơn Hàng (State Machine)</span>
                </h3>
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
                  <Input
                    placeholder="Ghi chú nội bộ cho lần chuyển trạng thái này (tùy chọn)..."
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    className="text-xs bg-white"
                  />
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const isPaid =
                        selectedOrder.paymentStatus === 'PAID' ||
                        selectedOrder.paymentStatus === 'PARTIALLY_REFUNDED';
                      const validStatuses = (ALLOWED_NEXT_STATUS[selectedOrder.status] || []).filter(
                        (next) => {
                          // Không hiển thị nút Hoàn tiền nếu đơn hàng chưa thanh toán
                          if (next === 'REFUNDED' && !isPaid) return false;
                          return true;
                        },
                      );

                      return validStatuses.length ? (
                        validStatuses.map((next) => {
                          const isBlockedCompletion =
                            next === 'COMPLETED' &&
                            selectedOrder.paymentMethod !== 'COD' &&
                            !isPaid;

                          return (
                            <Button
                              key={next}
                              size="sm"
                              disabled={isBlockedCompletion}
                              title={
                                isBlockedCompletion
                                  ? 'Cần bấm "Xác Nhận Đã Thu Tiền" bên trên trước khi hoàn tất đơn hàng chuyển khoản'
                                  : undefined
                              }
                              variant={next === 'CANCELLED' ? 'outline' : 'default'}
                              onClick={() => handleUpdateStatus(next)}
                              className={
                                next === 'CANCELLED'
                                  ? 'text-red-600 hover:bg-red-50 text-xs'
                                  : isBlockedCompletion
                                  ? 'opacity-50 cursor-not-allowed text-xs'
                                  : 'text-xs'
                              }
                            >
                              Chuyển sang: {next === 'REFUNDED' ? 'Hoàn tiền (REFUNDED)' : next === 'CANCELLED' ? 'Hủy / Đóng đơn' : next}
                            </Button>
                          );
                        })
                      ) : (
                        <p className="text-xs text-gray-500 italic">
                          Đơn hàng đã ở trạng thái kết thúc ({selectedOrder.status}), không thể chuyển trạng thái tiếp theo.
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Status History Audit Log */}
              {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center space-x-1.5">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>Lịch Sử Tiến Trình Đơn Hàng</span>
                  </h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/70">
                          <TableHead className="text-xs">Thời Gian</TableHead>
                          <TableHead className="text-xs">Trạng Thái</TableHead>
                          <TableHead className="text-xs">Người Thực Hiện</TableHead>
                          <TableHead className="text-xs">Ghi Chú</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.statusHistory.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell className="text-[11px] text-gray-500">
                              {formatDateTimeVN(h.createdAt)}
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-gray-900">
                              {h.fromStatus ? `${h.fromStatus} → ` : ''}{h.toStatus}
                            </TableCell>
                            <TableCell className="text-xs text-gray-600">
                              {h.changedBy}
                            </TableCell>
                            <TableCell className="text-xs text-gray-600 italic">
                              {h.note || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedOrder(null)}
                className="text-xs"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
