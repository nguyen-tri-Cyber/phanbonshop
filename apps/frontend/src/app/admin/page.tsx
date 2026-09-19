'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Clock,
  Boxes,
  ArrowUpRight,
  RefreshCw,
  Package,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { formatCurrencyVND, formatDateTimeVN } from '../../lib/formatters';
import { useAuth } from '../../contexts/auth-context';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table';

interface DashboardData {
  revenueToday: number;
  revenueMonth: number;
  ordersToday: number;
  pendingOrders: number;
  averageOrderValue: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    totalAmount: number;
    recipientName: string;
    phone: string;
    createdAt: string;
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    totalSold: number;
    totalRevenue: number;
  }>;
  lowStockCount: number;
  lowStockItems: Array<{
    id: string;
    productId: string;
    variantId: string;
    stockQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    reorderLevel: number;
  }>;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient<DashboardData>(
        '/orders/admin/dashboard',
        { requireAuth: true },
      );

      if (res.success) {
        setData(res.data);
      } else {
        setErrorMessage(res.error?.message || 'Không thể tải chỉ số dashboard');
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Lỗi kết nối máy chủ quản trị',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'PROCESSING':
      case 'PAID':
        return <Badge variant="success">{status}</Badge>;
      case 'PENDING':
        return <Badge variant="warning">CHỜ XỬ LÝ</Badge>;
      case 'CANCELLED':
      case 'FAILED':
        return <Badge variant="destructive">{status}</Badge>;
      case 'SHIPPED':
      case 'PACKING':
        return <Badge className="bg-blue-600 text-white">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-primary-700 text-xs font-semibold uppercase tracking-wider">
            <Boxes className="h-4 w-4" />
            <span>Phân Hệ Quản Trị Trung Tâm</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mt-1">
            Bảng Điều Khiển Quản Trị
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Xin chào, <strong>{user?.fullName}</strong> ({user?.role}). Toàn bộ chỉ số bên dưới được tính toán trực tiếp từ cơ sở dữ liệu thật.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới dữ liệu
          </Button>
          <Link href="/admin/don-hang">
            <Button size="sm" className="text-xs">
              Xem đơn hàng
              <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Doanh thu hôm nay */}
        <Card className="border-gray-200 shadow-sm hover:border-primary-300 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Doanh Thu Hôm Nay</span>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <div className="text-xl font-black text-emerald-700">
                  {formatCurrencyVND(data?.revenueToday || 0)}
                </div>
              )}
              <p className="text-[10px] text-gray-500 mt-1">Chỉ tính đơn đã thanh toán</p>
            </div>
          </CardContent>
        </Card>

        {/* Doanh thu tháng */}
        <Card className="border-gray-200 shadow-sm hover:border-primary-300 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Doanh Thu Tháng Này</span>
              <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <div className="text-xl font-black text-primary-800">
                  {formatCurrencyVND(data?.revenueMonth || 0)}
                </div>
              )}
              <p className="text-[10px] text-gray-500 mt-1">Múi giờ Asia/Ho_Chi_Minh</p>
            </div>
          </CardContent>
        </Card>

        {/* Số đơn hôm nay */}
        <Card className="border-gray-200 shadow-sm hover:border-primary-300 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Số Đơn Hôm Nay</span>
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-black text-gray-900">
                  {data?.ordersToday ?? 0}
                </div>
              )}
              <p className="text-[10px] text-gray-500 mt-1">Tất cả đơn đặt trong ngày</p>
            </div>
          </CardContent>
        </Card>

        {/* Đơn chờ xử lý */}
        <Card className="border-gray-200 shadow-sm hover:border-amber-300 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Đơn Chờ Xử Lý</span>
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-black text-amber-600">
                  {data?.pendingOrders ?? 0}
                </div>
              )}
              <p className="text-[10px] text-gray-500 mt-1">Đơn ở trạng thái PENDING</p>
            </div>
          </CardContent>
        </Card>

        {/* Average Order Value */}
        <Card className="border-gray-200 shadow-sm hover:border-primary-300 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Giá Trị TB Đơn (AOV)</span>
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {isLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <div className="text-lg font-black text-gray-900">
                  {formatCurrencyVND(data?.averageOrderValue || 0)}
                </div>
              )}
              <p className="text-[10px] text-gray-500 mt-1">Doanh thu / số đơn đã thanh toán</p>
            </div>
          </CardContent>
        </Card>

        {/* Cảnh báo tồn kho thấp */}
        <Link href="/admin/kho-hang">
          <Card className="border-gray-200 shadow-sm hover:border-red-300 hover:bg-red-50/30 transition-colors cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Cảnh Báo Tồn Thấp</span>
                <div className="p-2 bg-red-50 rounded-lg text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <div className="text-2xl font-black text-red-600">
                    {data?.lowStockCount ?? 0}
                  </div>
                )}
                <p className="text-[10px] text-red-500 font-medium mt-1">Xem chi tiết kho hàng →</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Grid: Recent Orders & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Đơn hàng gần đây (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="p-5 border-b border-gray-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-gray-900">
                  Đơn Hàng Gần Đây
                </CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  8 giao dịch phân bón mới nhất phát sinh trên toàn sàn
                </p>
              </div>
              <Link href="/admin/don-hang">
                <Button variant="ghost" size="sm" className="text-xs text-primary-700 hover:text-primary-800">
                  Xem tất cả <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/60">
                    <TableHead className="text-xs font-semibold">Mã Đơn</TableHead>
                    <TableHead className="text-xs font-semibold">Khách Hàng</TableHead>
                    <TableHead className="text-xs font-semibold">Trạng Thái</TableHead>
                    <TableHead className="text-xs font-semibold">Thanh Toán</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Tổng Tiền</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Thời Gian</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : !data?.recentOrders || data.recentOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-xs text-gray-500">
                        Chưa có đơn hàng nào được ghi nhận.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recentOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50/80">
                        <TableCell className="font-mono text-xs font-bold text-primary-800">
                          <Link href={`/admin/don-hang?search=${order.orderNumber}`} className="hover:underline">
                            {order.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-gray-900">
                          <div>{order.recipientName}</div>
                          {order.phone && <div className="text-[11px] text-gray-400">{order.phone}</div>}
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
                        <TableCell className="text-xs font-bold text-gray-900 text-right">
                          {formatCurrencyVND(order.totalAmount)}
                        </TableCell>
                        <TableCell className="text-[11px] text-gray-500 text-right">
                          {formatDateTimeVN(order.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Top Sản Phẩm Bán Chạy (1 col) */}
        <div className="space-y-4">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="p-5 border-b border-gray-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-gray-900">
                  Sản Phẩm Bán Chạy
                </CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  Dựa trên các đơn hàng đã thanh toán thật
                </p>
              </div>
              <Package className="h-4 w-4 text-primary-600" />
            </CardHeader>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : !data?.topProducts || data.topProducts.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500">
                  Chưa có dữ liệu sản phẩm bán ra từ đơn thanh toán.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.topProducts.map((p, idx) => (
                    <div
                      key={p.productId}
                      className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className="h-6 w-6 rounded-full bg-primary-100 text-primary-800 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {p.productName}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Đã bán: <span className="font-bold text-gray-800">{p.totalSold}</span> bao/chai
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-bold text-emerald-700">
                          {formatCurrencyVND(p.totalRevenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
