'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  Package,
  CreditCard,
  MapPin,
  ArrowRight,
  Copy,
  Check,
  Printer,
  Calendar,
  Truck,
  Building,
  Smartphone,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Skeleton } from '../../../../components/ui/skeleton';
import { apiClient } from '../../../../lib/api-client';
import { formatCurrencyVND } from '../../../../lib/formatters';
import { Order } from '../../../../types/index';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumberParam = searchParams.get('orderNumber');
  const orderIdParam = searchParams.get('orderId');

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const idOrNumber = orderNumberParam || orderIdParam;
    if (!idOrNumber) {
      setIsLoading(false);
      return;
    }

    async function fetchOrderDetail() {
      setIsLoading(true);
      try {
        const res = await apiClient<Order>(`/orders/${idOrNumber}`, {
          requireAuth: true,
        });
        if (res.success && res.data) {
          setOrder(res.data);
        }
      } catch (err) {
        console.error('Lỗi tải thông tin đơn hàng:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrderDetail();
  }, [orderNumberParam, orderIdParam]);

  const handleCopyOrderNumber = () => {
    const textToCopy = order?.orderNumber || orderNumberParam || '';
    if (textToCopy && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const effectiveOrderNumber = order?.orderNumber || orderNumberParam || 'Đang cập nhật';
  const totalAmountNum = order ? Number(order.totalAmount) : 0;
  const isBankTransfer = order?.paymentMethod === 'BANK_TRANSFER';
  const isMomo = order?.paymentMethod === 'MOMO';

  // VietQR Dynamic URL (MB Bank standard)
  const vietQrUrl = `https://img.vietqr.io/image/mbbank-0386888999-compact2.png?amount=${totalAmountNum}&addInfo=${effectiveOrderNumber}&accountName=CONG%20TY%20CO%20PHAN%20PHAN%20BON%20SHOP%20VIET%20NAM`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* 1. Header Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-800 to-primary-950 text-white p-6 sm:p-8 text-center space-y-4 shadow-xl">
        <div className="h-16 w-16 bg-emerald-500/20 text-emerald-300 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Đặt Hàng Mùa Vụ Thành Công!
          </h1>
          <p className="text-xs sm:text-sm text-primary-200 max-w-lg mx-auto">
            Hệ thống đã tiếp nhận đơn hàng của quý khách và tạm giữ tồn kho thành công.
            Nhân viên điều phối sẽ liên hệ để xác nhận lịch vận chuyển phân bón tới ruộng / vườn.
          </p>
        </div>

        <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl text-xs sm:text-sm">
          <span className="text-primary-200">Mã đơn hàng:</span>
          <span className="font-mono font-black text-white text-base">
            {effectiveOrderNumber}
          </span>
          <button
            onClick={handleCopyOrderNumber}
            className="p-1 text-primary-200 hover:text-white transition-colors"
            title="Sao chép mã đơn"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* 2. VIETQR BANK TRANSFER BOX (If paymentMethod is BANK_TRANSFER) */}
      {isBankTransfer && (
        <Card className="border-2 border-primary-600 bg-primary-50/10 shadow-md overflow-hidden">
          <CardHeader className="bg-primary-700 text-white py-3 px-5">
            <CardTitle className="text-sm sm:text-base flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-harvest-300" />
              <span>Thông Tin Thanh Toán Chuyển Khoản Qua VietQR</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Left Details */}
              <div className="space-y-3 text-xs">
                <div className="flex items-center space-x-2 text-primary-900 font-bold text-sm">
                  <Building className="h-4 w-4 text-primary-700" />
                  <span>Ngân Hàng TMCP Quân Đội (MB Bank)</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Số tài khoản:</span>
                    <span className="font-mono font-bold text-gray-900 text-sm">
                      0386 888 999
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Chủ tài khoản:</span>
                    <span className="font-bold text-gray-900">
                      CTCP PHAN BON SHOP VN
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Số tiền cần chuyển:</span>
                    <span className="font-black text-primary-700 text-base">
                      {formatCurrencyVND(totalAmountNum)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-dashed border-gray-200">
                    <span className="text-gray-500">Nội dung chuyển khoản:</span>
                    <span className="font-mono font-bold text-red-600">
                      {effectiveOrderNumber}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 leading-tight">
                  <span className="font-bold">Lưu ý quan trọng:</span> Quý khách vui lòng nhập chính xác nội dung chuyển khoản là{' '}
                  <span className="font-bold text-red-600">{effectiveOrderNumber}</span> để hệ thống máy chủ tự động đối soát và xác nhận đơn trong 1-3 phút.
                </p>
              </div>

              {/* Right QR Image */}
              <div className="text-center space-y-2 bg-white p-4 rounded-xl border border-gray-200 shadow-inner flex flex-col items-center justify-center">
                <div className="w-52 h-52 relative border border-gray-200 rounded-lg p-2 bg-white shadow-sm">
                  <img
                    src={vietQrUrl}
                    alt="Mã VietQR thanh toán"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  Mở ứng dụng Mobile Banking của bất kỳ ngân hàng nào và quét mã QR trên
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2.2 MOMO PAYMENT BOX (If paymentMethod is MOMO) */}
      {isMomo && order?.paymentStatus !== 'PAID' && (
        <Card className="border-2 border-pink-600 bg-pink-50/10 shadow-md overflow-hidden">
          <CardHeader className="bg-pink-700 text-white py-3 px-5">
            <CardTitle className="text-sm sm:text-base flex items-center space-x-2">
              <Smartphone className="h-5 w-5 text-pink-200" />
              <span>Thanh Toán Trực Tuyến Qua Ví MoMo Sandbox</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-xs">
                <p className="text-sm font-bold text-gray-900">
                  Đơn hàng đang chờ hoàn tất thanh toán trên Ví MoMo.
                </p>
                <p className="text-gray-600">
                  Số tiền cần thanh toán:{' '}
                  <span className="font-black text-pink-700 text-sm">
                    {formatCurrencyVND(totalAmountNum)}
                  </span>
                </p>
                <p className="text-[11px] text-gray-500">
                  Mã tham chiếu đơn hàng:{' '}
                  <span className="font-mono font-bold text-gray-800">
                    {effectiveOrderNumber}
                  </span>
                </p>
                <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  Sau khi giao dịch thành công trên MoMo, hệ thống máy chủ sẽ tiếp nhận thông báo IPN tự động và lập tức xác nhận đơn hàng của quý khách.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Order Details Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recipient & Shipping Info */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm font-bold text-gray-900 flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-primary-700" />
              <span>Địa Chỉ Nhận Hàng</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 text-xs space-y-2">
            {order?.shippingAddress ? (
              <>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-gray-900 text-sm">
                    {order.shippingAddress.recipientName}
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="font-semibold text-gray-700">
                    {order.shippingAddress.phone}
                  </span>
                </div>
                <p className="text-gray-700">{order.shippingAddress.addressLine}</p>
                <p className="text-gray-500">
                  {order.shippingAddress.wardName}, {order.shippingAddress.districtName},{' '}
                  {order.shippingAddress.provinceName}
                </p>
              </>
            ) : (
              <p className="text-gray-500 italic">
                Thông tin người nhận đang được cập nhật từ hồ sơ giao dịch.
              </p>
            )}

            {order?.customerNote && (
              <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-600">
                <span className="font-semibold">Ghi chú của quý khách:</span>{' '}
                {order.customerNote}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment & Logistics Status */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm font-bold text-gray-900 flex items-center space-x-2">
              <Truck className="h-4 w-4 text-primary-700" />
              <span>Trạng Thái Vận Chuyển & Thanh Toán</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 text-xs space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Phương thức:</span>
              <span className="font-bold text-gray-900">
                {order?.paymentMethod === 'BANK_TRANSFER'
                  ? 'Chuyển khoản VietQR'
                  : order?.paymentMethod === 'MOMO'
                  ? 'Ví điện tử MoMo'
                  : 'Tiền mặt khi nhận hàng (COD)'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Trạng thái đơn:</span>
              <Badge variant="default" className="text-[11px] bg-amber-600">
                {order?.status || 'PENDING (Chờ xác nhận)'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Thanh toán:</span>
              <Badge
                variant={order?.paymentStatus === 'PAID' ? 'default' : 'secondary'}
                className="text-[11px]"
              >
                {order?.paymentStatus || 'PENDING (Chưa thanh toán)'}
              </Badge>
            </div>
            {order?.createdAt && (
              <div className="flex justify-between items-center text-gray-500 pt-1 border-t border-gray-100">
                <span className="flex items-center space-x-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Thời gian đặt:</span>
                </span>
                <span>{new Date(order.createdAt).toLocaleString('vi-VN')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Products Table (if loaded) */}
      {order?.items && order.items.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm font-bold text-gray-900 flex items-center space-x-2">
              <Package className="h-4 w-4 text-primary-700" />
              <span>Chi Tiết Mặt Hàng Phân Bón</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="divide-y divide-gray-100 text-xs">
              {order.items.map((item) => (
                <div key={item.id} className="py-2.5 first:pt-0 flex justify-between items-center">
                  <div className="space-y-0.5">
                    <h4 className="font-bold text-gray-900">{item.productName}</h4>
                    <p className="text-[11px] text-gray-500">
                      SKU: {item.sku} &bull; Số lượng: {item.quantity} bao
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-900">
                      {formatCurrencyVND(Number(item.lineTotal))}
                    </span>
                    <p className="text-[10px] text-gray-400">
                      {formatCurrencyVND(Number(item.unitPrice))}/bao
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Tạm tính:</span>
                <span>{formatCurrencyVND(Number(order.subtotal))}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Giảm giá ({order.couponCode || 'Coupon'}):</span>
                  <span>-{formatCurrencyVND(Number(order.discountAmount))}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Phí vận chuyển:</span>
                <span>
                  {Number(order.shippingFee) === 0
                    ? 'Miễn phí'
                    : formatCurrencyVND(Number(order.shippingFee))}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-gray-200 text-sm font-bold text-gray-900">
                <span>Tổng thanh toán:</span>
                <span className="text-lg font-black text-primary-800">
                  {formatCurrencyVND(Number(order.totalAmount))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Footer Actions */}
      <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200">
        <Button
          variant="outline"
          onClick={handlePrint}
          className="w-full sm:w-auto text-xs space-x-1.5 text-gray-700"
        >
          <Printer className="h-4 w-4" />
          <span>In Đơn Hàng</span>
        </Button>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Link href="/san-pham" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full text-xs">
              Tiếp Tục Mua Sắm
            </Button>
          </Link>

          <Link href="/tai-khoan?tab=orders" className="flex-1 sm:flex-none">
            <Button className="w-full text-xs font-bold space-x-1.5 shadow-sm">
              <span>Xem Đơn Hàng Của Tôi</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  );
}
