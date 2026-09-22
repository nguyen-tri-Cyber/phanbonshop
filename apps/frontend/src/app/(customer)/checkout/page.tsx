'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingBag,
  MapPin,
  CreditCard,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Tag,
  Plus,
  ArrowRight,
  Lock,
  RotateCcw,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../../../contexts/auth-context';
import { useCart } from '../../../contexts/cart-context';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { apiClient } from '../../../lib/api-client';
import { formatCurrencyVND } from '../../../lib/formatters';
import {
  CustomerAddress,
  CheckoutResult,
  CouponValidationResult,
  PaymentMethod,
} from '../../../types/index';
import {
  getProvinces,
  getDistricts,
  getWards,
  calculateShippingFee,
} from '@phanbonshop/shared-utils';
import { GoogleSignInButton } from '../../../components/auth/google-sign-in-button';

export default function CheckoutPage() {
  const requireGoogleRegistration =
    Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()) ||
    process.env.NEXT_PUBLIC_REQUIRE_GOOGLE_REGISTRATION === 'true';
  const router = useRouter();
  const { user, isLoading: isAuthLoading, login, register } = useAuth();
  const { items, totalPrice, clearCart, isLoading: isCartLoading, error: cartError } = useCart();

  // Auth Modal/Inline State for unauthenticated customers
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Address state
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');

  // New Address Form Fields
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState('');
  const [selectedWardCode, setSelectedWardCode] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [saveToBook, setSaveToBook] = useState(true);

  // Administrative Divisions dataset
  const provinces = getProvinces();
  const districts = selectedProvinceCode ? getDistricts(selectedProvinceCode) : [];
  const wards =
    selectedProvinceCode && selectedDistrictCode
      ? getWards(selectedProvinceCode, selectedDistrictCode)
      : [];

  // Payment & Order Notes
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [customerNote, setCustomerNote] = useState('');

  // Coupon state
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Checkout submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Client-generated Idempotency Key (UUIDv4)
  const idempotencyKeyRef = useRef<string>('');
  useEffect(() => {
    if (!idempotencyKeyRef.current && typeof window !== 'undefined') {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
  }, []);

  // Fetch saved addresses when user is authenticated
  const loadAddresses = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient<CustomerAddress[]>('/customers/me/addresses', {
        requireAuth: true,
      });
      if (res.success && res.data) {
        setAddresses(res.data);
        const defaultAddr = res.data.find((a) => a.isDefault) || res.data[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
        } else {
          setSelectedAddressId('new');
        }
      }
    } catch (err) {
      console.error('Lỗi tải sổ địa chỉ:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadAddresses();
      // Pre-fill recipient fields from user profile
      if (user.fullName) setRecipientName(user.fullName);
      if (user.phone) setRecipientPhone(user.phone);
    }
  }, [user, loadAddresses]);

  // Handle Quick Login
  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthSubmitting(true);
    const result = await login({ email: authEmail, password: authPassword });
    setIsAuthSubmitting(false);
    if (!result.success) {
      setAuthError(result.error || 'Đăng nhập không thành công');
    }
  };

  // Handle Quick Register
  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthSubmitting(true);
    const result = await register({
      fullName: authFullName,
      email: authEmail,
      phone: authPhone,
      password: authPassword,
    });
    setIsAuthSubmitting(false);
    if (!result.success) {
      setAuthError(result.error || 'Đăng ký không thành công');
    }
  };

  // Calculate pricing breakdown
  const subtotal = totalPrice;
  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const shippingProvince =
    selectedAddressId === 'new'
      ? selectedProvinceCode
      : addresses.find((address) => address.id === selectedAddressId)?.provinceCode || '';
  const shippingFee = calculateShippingFee({
    provinceCode: shippingProvince,
    subtotal,
    isFreeShippingCoupon: appliedCoupon?.isFreeShipping,
  }).shippingFee;
  const finalTotal = Math.max(0, subtotal - discountAmount + shippingFee);

  // Validate Coupon handler
  const handleValidateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;

    setCouponError(null);
    setIsValidatingCoupon(true);
    try {
      const res = await apiClient<CouponValidationResult>('/coupons/validate', {
        method: 'POST',
        requireAuth: true,
        body: JSON.stringify({
          code: couponCodeInput.trim().toUpperCase(),
          subtotal,
        }),
      });

      if (res.success && res.data.valid) {
        setAppliedCoupon(res.data);
      } else {
        const errorMsg = !res.success
          ? res.error.message
          : res.data.message || 'Mã giảm giá không hợp lệ';
        setCouponError(errorMsg);
        setAppliedCoupon(null);
      }
    } catch {
      setCouponError('Lỗi kiểm tra mã giảm giá');
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
    setCouponError(null);
  };

  // Submit Order Checkout
  const handleCheckoutSubmit = async () => {
    if (isSubmitting || isCartLoading || cartError) return;
    setCheckoutError(null);

    // Validate Items
    if (!items || items.length === 0) {
      setCheckoutError('Giỏ hàng của bạn đang trống.');
      return;
    }

    // Prepare Shipping Address
    let shippingAddressPayload;
    let chosenAddressId: string | undefined = undefined;

    if (selectedAddressId !== 'new') {
      const existing = addresses.find((a) => a.id === selectedAddressId);
      if (!existing) {
        setCheckoutError('Vui lòng chọn một địa chỉ nhận hàng hợp lệ.');
        return;
      }
      chosenAddressId = existing.id;
      shippingAddressPayload = {
        recipientName: existing.recipientName,
        phone: existing.phone,
        provinceCode: existing.provinceCode,
        provinceName: existing.provinceName,
        districtCode: existing.districtCode,
        districtName: existing.districtName,
        wardCode: existing.wardCode,
        wardName: existing.wardName,
        addressLine: existing.addressLine,
      };
    } else {
      // Validate new address inputs
      if (!recipientName.trim()) {
        setCheckoutError('Vui lòng nhập họ và tên người nhận.');
        return;
      }
      if (!recipientPhone.trim()) {
        setCheckoutError('Vui lòng nhập số điện thoại người nhận.');
        return;
      }
      if (!selectedProvinceCode) {
        setCheckoutError('Vui lòng chọn Tỉnh/Thành phố.');
        return;
      }
      if (!selectedDistrictCode) {
        setCheckoutError('Vui lòng chọn Quận/Huyện.');
        return;
      }
      if (!selectedWardCode) {
        setCheckoutError('Vui lòng chọn Phường/Xã.');
        return;
      }
      if (!addressLine.trim()) {
        setCheckoutError('Vui lòng nhập địa chỉ chi tiết (Thôn/Ấp/Xứ đồng).');
        return;
      }

      const provObj = provinces.find((p) => p.code === selectedProvinceCode);
      const distObj = districts.find((d) => d.code === selectedDistrictCode);
      const wardObj = wards.find((w) => w.code === selectedWardCode);

      shippingAddressPayload = {
        recipientName: recipientName.trim(),
        phone: recipientPhone.trim(),
        provinceCode: selectedProvinceCode,
        provinceName: provObj?.name || selectedProvinceCode,
        districtCode: selectedDistrictCode,
        districtName: distObj?.name || selectedDistrictCode,
        wardCode: selectedWardCode,
        wardName: wardObj?.name || selectedWardCode,
        addressLine: addressLine.trim(),
      };

      // If user selected "save to address book", save in background
      if (saveToBook && user) {
        apiClient('/customers/me/addresses', {
          method: 'POST',
          requireAuth: true,
          body: JSON.stringify({
            ...shippingAddressPayload,
            isDefault: addresses.length === 0,
          }),
        }).catch((e) => console.warn('Không thể tự động lưu sổ địa chỉ:', e));
      }
    }

    setIsSubmitting(true);

    try {
      const checkoutPayload = {
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        addressId: chosenAddressId,
        shippingAddress: shippingAddressPayload,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        paymentMethod,
        customerNote: customerNote.trim() || undefined,
      };

      // Include Idempotency-Key header
      const idempotencyKey = idempotencyKeyRef.current || crypto.randomUUID();

      const res = await apiClient<CheckoutResult>('/checkout', {
        method: 'POST',
        requireAuth: true,
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(checkoutPayload),
      });

      if (res.success && res.data) {
        // Clear cart
        await clearCart();

        // Nếu là thanh toán qua MoMo và có payUrl, chuyển hướng khách hàng sang cổng thanh toán MoMo
        const momoPayUrl =
          res.data.payUrl || (res.data.paymentDetails as Record<string, unknown> | null)?.payUrl;

        if (paymentMethod === 'MOMO' && typeof momoPayUrl === 'string' && momoPayUrl) {
          window.location.href = momoPayUrl;
          return;
        }

        // Chuyển hướng tới trang thông báo đặt hàng thành công
        router.push(
          `/checkout/thanh-cong?orderId=${res.data.orderId}&orderNumber=${res.data.orderNumber}`,
        );
      } else {
        const errorMsg = !res.success
          ? res.error.message
          : 'Không thể hoàn tất đặt hàng. Vui lòng kiểm tra lại thông tin tồn kho hoặc thử lại.';
        setCheckoutError(errorMsg);
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Lỗi kết nối máy chủ khi thực hiện thanh toán.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading State
  if (isAuthLoading || isCartLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-1">
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Empty Cart State
  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="h-20 w-20 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto shadow-inner">
          <ShoppingBag className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Giỏ Hàng Đang Trống</h1>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Quý bà con chưa có sản phẩm phân bón nào trong giỏ hàng. Vui lòng chọn sản phẩm NPK, hữu
          cơ vi sinh phù hợp với mùa vụ trước khi tiến hành thanh toán.
        </p>
        <div className="pt-4">
          <Link href="/san-pham">
            <Button className="px-6 py-2.5 font-semibold space-x-2">
              <span>Khám phá danh mục sản phẩm</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 3. Unauthenticated State (Prompt Login / Register)
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Card className="shadow-lg border-primary-100 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-800 to-primary-900 text-white p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-2 text-harvest-300">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold">Đăng Nhập Để Tiếp Tục Đặt Hàng</h2>
            <p className="text-xs text-primary-200 mt-1 max-w-md mx-auto">
              Đăng nhập giúp lưu lịch sử đơn mùa vụ, tra cứu hành trình vận chuyển tận bờ ruộng và
              tích điểm hội viên nông nghiệp.
            </p>
          </div>

          <CardContent className="p-6">
            <GoogleSignInButton mode="signin" onAuthenticated={() => undefined} />

            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  hoặc dùng mật khẩu
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            )}

            {/* Mode Switcher */}
            <div className="flex border-b border-gray-200 mb-6">
              {!requireGoogleRegistration && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors ${
                    authMode === 'login'
                      ? 'border-primary-700 text-primary-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Đăng Nhập Có Sẵn
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError(null);
                }}
                className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors ${
                  authMode === 'register'
                    ? 'border-primary-700 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Đăng Ký Tài Khoản Mới
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={handleQuickLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email đăng nhập <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="VD: nongdan@gmail.com"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mật khẩu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full justify-center text-xs font-bold py-2.5"
                >
                  {isAuthSubmitting ? 'Đang xác thực...' : 'Đăng Nhập & Tiếp Tục'}
                </Button>
              </form>
            ) : !requireGoogleRegistration ? (
              <form onSubmit={handleQuickRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    placeholder="VD: Nguyễn Văn Nông"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Số điện thoại <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="VD: 0912345678"
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="VD: nongdan@gmail.com"
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mật khẩu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    minLength={6}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full justify-center text-xs font-bold py-2.5"
                >
                  {isAuthSubmitting ? 'Đang tạo tài khoản...' : 'Đăng Ký & Đặt Hàng'}
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. Main Authenticated Checkout Page
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs text-gray-500">
        <Link href="/" className="hover:text-primary-700 transition-colors">
          Trang chủ
        </Link>
        <span>/</span>
        <Link href="/san-pham" className="hover:text-primary-700 transition-colors">
          Sản phẩm
        </Link>
        <span>/</span>
        <span className="font-bold text-gray-900">Đặt hàng & Thanh toán</span>
      </div>

      <div className="pb-2 border-b border-gray-200">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
          <ShieldCheck className="h-7 w-7 text-primary-700" />
          <span>Tiến Hành Đặt Hàng Mùa Vụ</span>
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Hệ thống bảo vệ giao dịch phân tán và chống trùng lặp đơn hàng tự động
        </p>
      </div>

      {checkoutError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-800 flex items-start space-x-3 shadow-sm animate-in fade-in duration-200">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold">Không thể hoàn tất đơn hàng</h4>
            <p>{checkoutError}</p>
          </div>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Shipping Address, Payment, Notes (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* SECTION 1: SHIPPING ADDRESS */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-primary-700" />
                <span>Địa Chỉ Nhận Phân Bón</span>
              </CardTitle>
              {addresses.length > 0 && selectedAddressId !== 'new' && (
                <button
                  type="button"
                  onClick={() => setSelectedAddressId('new')}
                  className="text-xs text-primary-700 hover:text-primary-800 font-semibold flex items-center space-x-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Giao tới địa chỉ mới</span>
                </button>
              )}
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Existing Saved Addresses Selection */}
              {addresses.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-gray-700">Chọn từ sổ địa chỉ đã lưu:</div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedAddressId === addr.id
                            ? 'border-primary-600 bg-primary-50/30 ring-1 ring-primary-500'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="selectedAddress"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                        />
                        <div className="flex-1 min-w-0 text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-gray-900">{addr.recipientName}</span>
                            <span className="text-gray-400">|</span>
                            <span className="font-semibold text-gray-700">{addr.phone}</span>
                            {addr.isDefault && (
                              <Badge variant="default" className="text-[10px] bg-primary-700">
                                Mặc định
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-600 mt-1">{addr.addressLine}</p>
                          <p className="text-gray-500">
                            {addr.wardName}, {addr.districtName}, {addr.provinceName}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* New Address Form (if selected 'new' or no saved addresses) */}
              {(selectedAddressId === 'new' || addresses.length === 0) && (
                <div className="pt-2 space-y-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800">
                      Nhập địa chỉ giao hàng mới tận ruộng / vườn:
                    </span>
                    {addresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedAddressId(addresses[0].id)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Hủy, dùng địa chỉ có sẵn
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Họ và tên người nhận <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="VD: Nguyễn Văn Nông"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Số điện thoại nhận hàng <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        placeholder="VD: 0912345678"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Cascading Vietnam Dropdowns */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Tỉnh / Thành phố <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedProvinceCode}
                        onChange={(e) => {
                          setSelectedProvinceCode(e.target.value);
                          setSelectedDistrictCode('');
                          setSelectedWardCode('');
                        }}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      >
                        <option value="">-- Chọn Tỉnh / Thành phố --</option>
                        {provinces.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Quận / Huyện <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={selectedDistrictCode}
                          onChange={(e) => {
                            setSelectedDistrictCode(e.target.value);
                            setSelectedWardCode('');
                          }}
                          disabled={!selectedProvinceCode}
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">-- Chọn Quận / Huyện --</option>
                          {districts.map((d) => (
                            <option key={d.code} value={d.code}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Phường / Xã <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={selectedWardCode}
                          onChange={(e) => setSelectedWardCode(e.target.value)}
                          disabled={!selectedDistrictCode}
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">-- Chọn Phường / Xã --</option>
                          {wards.map((w) => (
                            <option key={w.code} value={w.code}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Địa chỉ chi tiết (Thôn / Ấp / Xứ đồng / Số nhà){' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={addressLine}
                        onChange={(e) => setAddressLine(e.target.value)}
                        placeholder="VD: Ấp 3, Xứ đồng Cánh Đông (Gần cầu Kênh 5)"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="checkbox"
                        id="saveToBookCheckbox"
                        checked={saveToBook}
                        onChange={(e) => setSaveToBook(e.target.checked)}
                        className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                      />
                      <label
                        htmlFor="saveToBookCheckbox"
                        className="text-xs text-gray-700 select-none cursor-pointer"
                      >
                        Lưu vào sổ địa chỉ để sử dụng cho các mùa vụ sau
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECTION 2: PAYMENT METHOD */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
              <CardTitle className="text-base flex items-center space-x-2">
                <CreditCard className="h-5 w-5 text-primary-700" />
                <span>Phương Thức Thanh Toán</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {/* Option 1: COD */}
              <label
                className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === 'COD'
                    ? 'border-primary-600 bg-primary-50/20 ring-1 ring-primary-500'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethodRadio"
                  checked={paymentMethod === 'COD'}
                  onChange={() => setPaymentMethod('COD')}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <Truck className="h-4 w-4 text-primary-700" />
                    <span className="text-xs font-bold text-gray-900">
                      Thanh toán khi nhận hàng (COD)
                    </span>
                    <Badge variant="default" className="text-[10px] bg-amber-600">
                      Phổ biến ở nông thôn
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Bà con được đồng kiểm bao bì, tem chống hàng giả và số lượng phân bón trước khi
                    thanh toán tiền mặt cho tài xế giao hàng.
                  </p>
                </div>
              </label>

              {/* Option 2: BANK TRANSFER (VietQR) */}
              <label
                className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === 'BANK_TRANSFER'
                    ? 'border-primary-600 bg-primary-50/20 ring-1 ring-primary-500'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethodRadio"
                  checked={paymentMethod === 'BANK_TRANSFER'}
                  onChange={() => setPaymentMethod('BANK_TRANSFER')}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="h-4 w-4 text-primary-700" />
                    <span className="text-xs font-bold text-gray-900">
                      Chuyển khoản ngân hàng (Mã VietQR 24/7)
                    </span>
                    <Badge variant="default" className="text-[10px] bg-primary-700">
                      Tự động & An toàn
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Quét mã QR chuẩn VietQR qua ứng dụng bất kỳ ngân hàng nào. Hệ thống tự động khớp
                    mã đơn và cập nhật trạng thái đơn hàng.
                  </p>
                </div>
              </label>

              {/* Option 3: MOMO WALLET */}
              <label
                className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === 'MOMO'
                    ? 'border-pink-600 bg-pink-50/20 ring-1 ring-pink-500'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethodRadio"
                  checked={paymentMethod === 'MOMO'}
                  onChange={() => setPaymentMethod('MOMO')}
                  className="mt-1 h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="h-4 w-4 text-pink-600" />
                    <span className="text-xs font-bold text-gray-900">
                      Ví điện tử MoMo (Sandbox / QR MoMo)
                    </span>
                    <Badge variant="default" className="text-[10px] bg-pink-600">
                      Nhanh chóng & Tiện lợi
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Thanh toán an toàn qua Ví MoMo bằng cách quét mã QR hoặc chuyển hướng sang cổng
                    thanh toán trực tuyến MoMo.
                  </p>
                </div>
              </label>
            </CardContent>
          </Card>

          {/* SECTION 3: CUSTOMER NOTES */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
              <CardTitle className="text-xs font-bold text-gray-800">
                Ghi Chú Đơn Hàng Mùa Vụ (Tùy chọn)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="VD: Giao trước 9h sáng, gọi trước khi xe tải tới đầu kênh 5..."
                rows={2}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Order Summary & Confirmation (5 cols, sticky) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
          <Card className="shadow-md border-gray-200">
            <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-gray-900">
                  Tóm Tắt Đơn Hàng ({items.length} mặt hàng)
                </CardTitle>
                <span className="text-xs font-semibold text-primary-700">
                  Tổng {items.reduce((sum, i) => sum + i.quantity, 0)} sản phẩm
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Product Items List */}
              <div className="max-h-60 overflow-y-auto space-y-3 pr-1 divide-y divide-gray-100">
                {items.map((item) => (
                  <div
                    key={item.variantId}
                    className="pt-2 first:pt-0 flex items-start justify-between text-xs"
                  >
                    <div className="flex-1 pr-3 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{item.productName}</h4>
                      <p className="text-gray-500 text-[11px]">
                        Quy cách: {item.packageSize} &bull; SL: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right font-bold text-gray-900 flex-shrink-0">
                      {formatCurrencyVND(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon Form */}
              <div className="pt-3 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center space-x-1">
                  <Tag className="h-3.5 w-3.5 text-primary-600" />
                  <span>Mã Giảm Giá (Coupon)</span>
                </label>

                {appliedCoupon ? (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-1.5 font-bold text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>{appliedCoupon.code}</span>
                      </div>
                      <p className="text-[11px] text-emerald-700">
                        Đã giảm {formatCurrencyVND(appliedCoupon.discountAmount)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-[11px] font-semibold text-red-600 hover:text-red-700 hover:underline"
                    >
                      Bỏ mã
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleValidateCoupon} className="space-y-1.5">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={couponCodeInput}
                        onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                        placeholder="VD: PHANBON50K"
                        className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none uppercase"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isValidatingCoupon || !couponCodeInput.trim()}
                        className="text-xs font-semibold px-3"
                      >
                        {isValidatingCoupon ? 'Đang xét...' : 'Áp Dụng'}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-[11px] text-red-600 flex items-center space-x-1">
                        <AlertCircle className="h-3 w-3" />
                        <span>{couponError}</span>
                      </p>
                    )}
                  </form>
                )}
              </div>

              {/* Price Calculation Breakdown */}
              <div className="pt-3 border-t border-gray-100 space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Tạm tính tiền hàng:</span>
                  <span className="font-semibold text-gray-900">{formatCurrencyVND(subtotal)}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Mã giảm giá ({appliedCoupon.code}):</span>
                    <span className="font-bold">-{formatCurrencyVND(discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-gray-600 items-center">
                  <div className="flex items-center space-x-1">
                    <span>Phí vận chuyển:</span>
                    {shippingFee === 0 && (
                      <Badge variant="default" className="text-[10px] bg-emerald-600">
                        Freeship
                      </Badge>
                    )}
                  </div>
                  <span className="font-semibold text-gray-900">
                    {!shippingProvince
                      ? 'Chọn tỉnh/thành để tính phí'
                      : shippingFee === 0
                        ? 'Miễn phí'
                        : formatCurrencyVND(shippingFee)}
                  </span>
                </div>

                <div className="pt-3 border-t border-gray-200 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-gray-900">
                    {shippingProvince ? 'Tổng cộng thanh toán:' : 'Tổng tạm tính:'}
                  </span>
                  <span className="text-xl font-black text-primary-800">
                    {formatCurrencyVND(shippingProvince ? finalTotal : subtotal - discountAmount)}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 text-right">
                  (Đã bao gồm thuế GTGT và phí đóng gói bao bì)
                </p>
              </div>

              {/* Submission Button */}
              <div className="pt-2">
                {cartError && (
                  <p role="alert" className="mb-3 text-sm text-red-700">
                    {cartError} Vui lòng mở giỏ hàng và thử đồng bộ lại.
                  </p>
                )}
                <Button
                  onClick={handleCheckoutSubmit}
                  disabled={isSubmitting || isCartLoading || Boolean(cartError)}
                  className="w-full justify-center py-3 text-sm font-black tracking-wide space-x-2 shadow-md hover:shadow-lg transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCcw className="h-4 w-4 animate-spin" />
                      <span>Đang tạo đơn & khóa tồn kho...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      <span>XÁC NHẬN ĐẶT HÀNG</span>
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-gray-500 text-center mt-2 flex items-center justify-center space-x-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary-600" />
                  <span>Cam kết phân bón chính hãng & hỗ trợ đổi trả nếu rách vỡ</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
