'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  MapPin,
  ShoppingBag,
  X,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { formatCurrencyVND, formatDateTimeVN } from '../../../lib/formatters';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../components/ui/table';

interface CustomerSummary {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  addressCount: number;
  orderCount: number;
  totalSpend: number;
  createdAt: string;
}

interface Address {
  id: string;
  recipientName: string;
  phone: string;
  provinceName: string;
  districtName: string;
  wardName: string;
  addressLine: string;
  isDefault: boolean;
}

interface CustomerOrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmount: number;
  createdAt: string;
}

interface CustomerDetail {
  profile: {
    id: string;
    userId: string;
    fullName: string;
    phone: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
  addresses: Address[];
  orderCount: number;
  totalSpend: number;
  orders: CustomerOrderDetail[];
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await apiClient<{
        items: CustomerSummary[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/customers/admin?${params.toString()}`, { requireAuth: true });

      if (res.success && res.data) {
        setCustomers(res.data.items || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const viewCustomerDetail = async (userId: string) => {
    try {
      const res = await apiClient<CustomerDetail>(`/customers/admin/${userId}`, {
        requireAuth: true,
      });
      if (res.success && res.data) {
        setSelectedCustomer(res.data);
      }
    } catch (err) {
      alert('Không thể tải chi tiết khách hàng: ' + (err instanceof Error ? err.message : ''));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
            <Users className="h-6 w-6 text-primary-600" />
            <span>Hồ Sơ Khách Hàng Nông Dân</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Tổng hợp thông tin cá nhân, sổ địa chỉ nhận hàng và lịch sử chi tiêu thực tế.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchCustomers()}
          disabled={isLoading}
          className="text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm theo tên hoặc số điện thoại..."
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

      {/* Customers Table */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70">
                <TableHead className="text-xs font-semibold">Khách Hàng</TableHead>
                <TableHead className="text-xs font-semibold">Số Điện Thoại</TableHead>
                <TableHead className="text-xs font-semibold text-center">Sổ Địa Chỉ</TableHead>
                <TableHead className="text-xs font-semibold text-center">Số Đơn Hàng</TableHead>
                <TableHead className="text-xs font-semibold text-right">Tổng Chi Tiêu</TableHead>
                <TableHead className="text-xs font-semibold text-right">Ngày Tham Gia</TableHead>
                <TableHead className="text-xs font-semibold text-center">Hành Động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-xs text-gray-500">
                    Không tìm thấy khách hàng nào.
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id} className="hover:bg-gray-50/60 transition-colors">
                    <TableCell className="text-xs font-semibold text-gray-900">
                      <div className="flex items-center space-x-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center">
                          {c.fullName?.charAt(0) || 'K'}
                        </div>
                        <div>
                          <div>{c.fullName}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{c.userId}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-700">
                      {c.phone || '—'}
                    </TableCell>
                    <TableCell className="text-center text-xs text-gray-700">
                      <Badge variant="outline" className="text-[10px]">
                        {c.addressCount} địa chỉ
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs font-bold text-gray-900">
                      {c.orderCount}
                    </TableCell>
                    <TableCell className="text-right text-xs font-black text-emerald-700">
                      {formatCurrencyVND(c.totalSpend)}
                    </TableCell>
                    <TableCell className="text-right text-[11px] text-gray-500">
                      {formatDateTimeVN(c.createdAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewCustomerDetail(c.userId)}
                        className="text-xs h-8 px-2.5"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1 text-primary-600" />
                        Hồ sơ
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
                Trang {page} / {totalPages} (Tổng {total} khách hàng)
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

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            {/* Header */}
            <div className="sticky top-0 bg-white p-5 border-b border-gray-100 flex items-center justify-between z-10">
              <div>
                <h2 className="text-base font-black text-gray-900">
                  {selectedCustomer.profile.fullName}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  ID: {selectedCustomer.profile.userId}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 text-xs">
              {/* Profile Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-500">Số điện thoại:</span>
                  <p className="font-bold text-gray-900 mt-0.5">
                    {selectedCustomer.profile.phone || 'Chưa cập nhật'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Tổng số đơn hàng:</span>
                  <p className="font-bold text-gray-900 mt-0.5">
                    {selectedCustomer.orderCount} đơn
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Tổng chi tiêu:</span>
                  <p className="font-black text-emerald-700 mt-0.5">
                    {formatCurrencyVND(selectedCustomer.totalSpend)}
                  </p>
                </div>
              </div>

              {/* Addresses List */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center space-x-1.5">
                  <MapPin className="h-4 w-4 text-primary-600" />
                  <span>Sổ Địa Chỉ Giao Hàng ({selectedCustomer.addresses.length})</span>
                </h3>
                {selectedCustomer.addresses.length === 0 ? (
                  <p className="text-gray-400 italic">Khách hàng chưa lưu địa chỉ nào.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="p-3 rounded-lg border border-gray-200 bg-white flex items-start justify-between"
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-gray-900">
                            {addr.recipientName} • {addr.phone}
                          </p>
                          <p className="text-gray-600">
                            {addr.addressLine}, {addr.wardName}, {addr.districtName}, {addr.provinceName}
                          </p>
                        </div>
                        {addr.isDefault && (
                          <Badge variant="success" className="text-[9px]">Mặc định</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order History */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center space-x-1.5">
                  <ShoppingBag className="h-4 w-4 text-primary-600" />
                  <span>Lịch Sử Đơn Hàng Gần Đây</span>
                </h3>
                {selectedCustomer.orders.length === 0 ? (
                  <p className="text-gray-400 italic">Chưa phát sinh đơn hàng nào.</p>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/70">
                          <TableHead className="text-xs">Mã Đơn</TableHead>
                          <TableHead className="text-xs">Trạng Thái</TableHead>
                          <TableHead className="text-xs">Thanh Toán</TableHead>
                          <TableHead className="text-xs text-right">Tổng Tiền</TableHead>
                          <TableHead className="text-xs text-right">Ngày Đặt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCustomer.orders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-xs font-bold text-primary-800">
                              {o.orderNumber}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={o.paymentStatus === 'PAID' ? 'success' : 'outline'}
                                className="text-[10px]"
                              >
                                {o.paymentStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-black text-gray-900 text-right">
                              {formatCurrencyVND(o.totalAmount)}
                            </TableCell>
                            <TableCell className="text-[11px] text-gray-500 text-right">
                              {formatDateTimeVN(o.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
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
