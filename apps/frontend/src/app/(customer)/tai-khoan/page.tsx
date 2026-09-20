'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  User as UserIcon,
  LogOut,
  LayoutDashboard,
  Package,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  Building,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../../contexts/auth-context';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { apiClient } from '../../../lib/api-client';
import { formatCurrencyVND } from '../../../lib/formatters';
import {
  CustomerAddress,
  CustomerProfile,
  Order,
} from '../../../types/index';
import {
  getProvinces,
  getDistricts,
  getWards,
} from '@phanbonshop/shared-utils';

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading, logout, isAdmin, refreshSession } =
    useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'orders'>(
    'profile',
  );

  // Sync tab from searchParams (e.g. /tai-khoan?tab=orders)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'orders' || tabParam === 'addresses' || tabParam === 'profile') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  // Profile Form state
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Address state
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Address Form state
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState('');
  const [selectedWardCode, setSelectedWardCode] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [addressFormError, setAddressFormError] = useState<string | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Divisions dataset
  const provinces = getProvinces();
  const districts = selectedProvinceCode ? getDistricts(selectedProvinceCode) : [];
  const wards =
    selectedProvinceCode && selectedDistrictCode
      ? getWards(selectedProvinceCode, selectedDistrictCode)
      : [];

  // Sync user profile fields
  useEffect(() => {
    if (user) {
      setProfileName(user.fullName || '');
      setProfilePhone(user.phone || '');
    }
  }, [user]);

  // Load addresses
  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setIsLoadingAddresses(true);
    try {
      const res = await apiClient<CustomerAddress[]>(
        '/customers/me/addresses',
        {
          requireAuth: true,
        },
      );
      if (res.success && res.data) {
        setAddresses(res.data);
      }
    } catch (err) {
      console.error('Failed to load customer addresses:', err);
    } finally {
      setIsLoadingAddresses(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadAddresses();
    }
  }, [user, loadAddresses]);

  // Load orders
  const loadOrders = useCallback(async () => {
    if (!user) return;
    setIsLoadingOrders(true);
    try {
      const res = await apiClient<Order[]>('/orders', {
        requireAuth: true,
      });
      if (res.success && res.data) {
        setOrders(res.data);
      }
    } catch (err) {
      console.error('Failed to load customer orders:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === 'orders') {
      loadOrders();
    }
  }, [user, activeTab, loadOrders]);

  // Handle Cancel Order
  const handleCancelOrder = async (orderId: string, orderNumber: string) => {
    const reason = prompt(
      `Xác nhận hủy đơn hàng ${orderNumber}?\nVui lòng nhập lý do hủy đơn:`,
      'Thay đổi kế hoạch mùa vụ / Đặt nhầm số lượng',
    );
    if (reason === null) return;

    setCancellingOrderId(orderId);
    try {
      const res = await apiClient(`/orders/${orderId}/cancel`, {
        method: 'POST',
        requireAuth: true,
        body: JSON.stringify({
          reason: reason.trim() || 'Khách hàng yêu cầu hủy đơn qua giao diện',
        }),
      });

      if (res.success) {
        alert(`Đã hủy đơn hàng ${orderNumber} thành công.`);
        await loadOrders();
      } else {
        alert(res.error?.message || 'Không thể hủy đơn hàng này.');
      }
    } catch {
      alert('Lỗi kết nối máy chủ khi hủy đơn hàng.');
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  // Update Profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    setIsUpdatingProfile(true);

    try {
      const res = await apiClient<CustomerProfile>('/customers/me', {
        method: 'PUT',
        requireAuth: true,
        body: JSON.stringify({
          fullName: profileName,
          phone: profilePhone,
        }),
      });

      if (res.success) {
        setProfileMessage({
          type: 'success',
          text: 'Cập nhật thông tin tài khoản thành công!',
        });
        await refreshSession();
      } else {
        setProfileMessage({
          type: 'error',
          text: res.error?.message || 'Cập nhật thất bại. Vui lòng thử lại.',
        });
      }
    } catch (err) {
      setProfileMessage({
        type: 'error',
        text: 'Lỗi kết nối khi cập nhật hồ sơ.',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Open modal to add address
  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setRecipientName(user?.fullName || '');
    setRecipientPhone(user?.phone || '');
    setSelectedProvinceCode('');
    setSelectedDistrictCode('');
    setSelectedWardCode('');
    setAddressLine('');
    setIsDefault(addresses.length === 0);
    setAddressFormError(null);
    setAddressModalOpen(true);
  };

  // Open modal to edit address
  const handleOpenEditAddress = (addr: CustomerAddress) => {
    setEditingAddressId(addr.id);
    setRecipientName(addr.recipientName);
    setRecipientPhone(addr.phone);
    setSelectedProvinceCode(addr.provinceCode);
    setSelectedDistrictCode(addr.districtCode);
    setSelectedWardCode(addr.wardCode);
    setAddressLine(addr.addressLine);
    setIsDefault(addr.isDefault);
    setAddressFormError(null);
    setAddressModalOpen(true);
  };

  // Save address (Create or Update)
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressFormError(null);

    if (!recipientName.trim()) {
      setAddressFormError('Vui lòng nhập họ và tên người nhận.');
      return;
    }
    if (!recipientPhone.trim()) {
      setAddressFormError('Vui lòng nhập số điện thoại người nhận.');
      return;
    }
    if (!selectedProvinceCode) {
      setAddressFormError('Vui lòng chọn Tỉnh / Thành phố.');
      return;
    }
    if (!selectedDistrictCode) {
      setAddressFormError('Vui lòng chọn Quận / Huyện / Thị xã.');
      return;
    }
    if (!selectedWardCode) {
      setAddressFormError('Vui lòng chọn Phường / Xã / Thị trấn.');
      return;
    }
    if (!addressLine.trim()) {
      setAddressFormError(
        'Vui lòng nhập số nhà, tên đường, thôn, ấp hoặc xứ đồng.',
      );
      return;
    }

    const prov = provinces.find((p) => p.code === selectedProvinceCode);
    const dist = districts.find((d) => d.code === selectedDistrictCode);
    const ward = wards.find((w) => w.code === selectedWardCode);

    const payload = {
      recipientName: recipientName.trim(),
      phone: recipientPhone.trim(),
      provinceCode: selectedProvinceCode,
      provinceName: prov ? prov.name : selectedProvinceCode,
      districtCode: selectedDistrictCode,
      districtName: dist ? dist.name : selectedDistrictCode,
      wardCode: selectedWardCode,
      wardName: ward ? ward.name : selectedWardCode,
      addressLine: addressLine.trim(),
      isDefault,
    };

    setIsSavingAddress(true);
    try {
      if (editingAddressId) {
        // Update
        const res = await apiClient<CustomerAddress>(
          `/customers/me/addresses/${editingAddressId}`,
          {
            method: 'PUT',
            requireAuth: true,
            body: JSON.stringify(payload),
          },
        );
        if (!res.success) {
          setAddressFormError(res.error?.message || 'Cập nhật địa chỉ thất bại.');
          return;
        }
      } else {
        // Create
        const res = await apiClient<CustomerAddress>(
          '/customers/me/addresses',
          {
            method: 'POST',
            requireAuth: true,
            body: JSON.stringify(payload),
          },
        );
        if (!res.success) {
          setAddressFormError(res.error?.message || 'Thêm địa chỉ mới thất bại.');
          return;
        }
      }

      setAddressModalOpen(false);
      await loadAddresses();
    } catch (err) {
      setAddressFormError('Lỗi kết nối máy chủ.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Delete address
  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa địa chỉ giao hàng này?')) return;
    try {
      const res = await apiClient(`/customers/me/addresses/${addressId}`, {
        method: 'DELETE',
        requireAuth: true,
      });
      if (res.success) {
        await loadAddresses();
      } else {
        alert(res.error?.message || 'Không thể xóa địa chỉ.');
      }
    } catch (err) {
      alert('Lỗi kết nối khi xóa địa chỉ.');
    }
  };

  // Set default address
  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      const res = await apiClient(
        `/customers/me/addresses/${addressId}/default`,
        {
          method: 'PATCH',
          requireAuth: true,
        },
      );
      if (res.success) {
        await loadAddresses();
      } else {
        alert(res.error?.message || 'Không thể đặt làm địa chỉ mặc định.');
      }
    } catch (err) {
      alert('Lỗi kết nối khi đặt địa chỉ mặc định.');
    }
  };

  if (isAuthLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center mx-auto">
          <UserIcon className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Chưa Đăng Nhập</h2>
        <p className="text-sm text-gray-500">
          Vui lòng đăng nhập để quản lý tài khoản, sổ địa chỉ giao phân bón tận
          ruộng/vườn và theo dõi tiến độ đơn hàng.
        </p>
        <div className="pt-2">
          <Link href="/dang-nhap?returnUrl=/tai-khoan">
            <Button className="w-full">Đăng Nhập Ngay</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Tài Khoản Khách Hàng
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Quản lý hồ sơ cá nhân, sổ địa chỉ giao hàng và lịch sử mua phân bón
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isAdmin && (
            <Link href="/admin">
              <Button
                variant="secondary"
                size="sm"
                className="space-x-1.5 text-xs font-semibold"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Trang Quản Trị</span>
              </Button>
            </Link>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLogout}
            className="space-x-1.5 text-xs"
          >
            <LogOut className="h-4 w-4" />
            <span>Đăng Xuất</span>
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="text-center pb-4 border-b border-gray-100">
              <div className="h-16 w-16 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-bold text-2xl mx-auto shadow-inner">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <CardTitle className="text-base mt-2 truncate">
                {user.fullName}
              </CardTitle>
              <div className="flex justify-center mt-1">
                <Badge variant="default" className="text-xs">
                  {user.role}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-2.5 ${
                  activeTab === 'profile'
                    ? 'bg-primary-50 text-primary-900 border-l-4 border-primary-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <UserIcon className="h-4 w-4 text-primary-600" />
                <span>Hồ sơ cá nhân</span>
              </button>
              <button
                onClick={() => setActiveTab('addresses')}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-2.5 ${
                  activeTab === 'addresses'
                    ? 'bg-primary-50 text-primary-900 border-l-4 border-primary-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MapPin className="h-4 w-4 text-primary-600" />
                <span>Sổ địa chỉ giao hàng</span>
                {addresses.length > 0 && (
                  <span className="ml-auto bg-gray-200 text-gray-700 rounded-full px-1.5 py-0.5 text-[10px]">
                    {addresses.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-2.5 ${
                  activeTab === 'orders'
                    ? 'bg-primary-50 text-primary-900 border-l-4 border-primary-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Package className="h-4 w-4 text-primary-600" />
                <span>Đơn hàng mùa vụ</span>
              </button>
            </CardContent>
          </Card>

          {/* Hotline Box */}
          <div className="bg-gradient-to-br from-primary-800 to-primary-900 rounded-xl p-4 text-white shadow-sm space-y-2">
            <h4 className="font-bold text-xs">Tư vấn phân bón tận ruộng</h4>
            <p className="text-[11px] text-primary-200 leading-snug">
              Bà con cần hỗ trợ công thức NPK cho lúa, sầu riêng hay cà phê?
            </p>
            <div className="pt-1 text-center font-black text-harvest-300 text-sm bg-white/10 rounded py-1">
              Hotline: 1800 6868
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="md:col-span-3">
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <Card className="shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="text-base flex items-center space-x-2">
                  <UserIcon className="h-5 w-5 text-primary-600" />
                  <span>Thông Tin Cá Nhân</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {profileMessage && (
                  <div
                    className={`mb-4 p-3 rounded-lg text-xs flex items-center space-x-2 ${
                      profileMessage.type === 'success'
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {profileMessage.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span>{profileMessage.text}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Họ và tên <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Số điện thoại
                      </label>
                      <input
                        type="tel"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="VD: 0912345678"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Email đăng nhập
                      </label>
                      <input
                        type="email"
                        value={user.email}
                        disabled
                        className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Vai trò tài khoản
                      </label>
                      <input
                        type="text"
                        value={user.role}
                        disabled
                        className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button
                      type="submit"
                      disabled={isUpdatingProfile}
                      className="text-xs font-semibold px-5"
                    >
                      {isUpdatingProfile ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: ADDRESSES */}
          {activeTab === 'addresses' && (
            <Card className="shadow-sm">
              <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-primary-600" />
                  <span>Sổ Địa Chỉ Giao Hàng</span>
                </CardTitle>
                <Button
                  size="sm"
                  onClick={handleOpenAddAddress}
                  className="space-x-1 text-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm Địa Chỉ Mới</span>
                </Button>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {isLoadingAddresses ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                  </div>
                ) : addresses.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 space-y-3">
                    <MapPin className="h-10 w-10 text-gray-300 mx-auto" />
                    <p className="text-xs">
                      Bạn chưa lưu địa chỉ nhận hàng nào.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenAddAddress}
                      className="text-xs"
                    >
                      Thêm địa chỉ ngay
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className={`p-4 rounded-xl border transition-all ${
                          addr.isDefault
                            ? 'border-primary-500 bg-primary-50/20'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm text-gray-900">
                                {addr.recipientName}
                              </span>
                              <span className="text-xs text-gray-400">|</span>
                              <span className="text-xs font-medium text-gray-600">
                                {addr.phone}
                              </span>
                              {addr.isDefault && (
                                <Badge
                                  variant="default"
                                  className="text-[10px] bg-primary-700"
                                >
                                  Mặc định
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-700">
                              {addr.addressLine}
                            </p>
                            <p className="text-xs text-gray-500">
                              {addr.wardName}, {addr.districtName},{' '}
                              {addr.provinceName}
                            </p>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleOpenEditAddress(addr)}
                              className="p-1.5 text-gray-500 hover:text-primary-700 hover:bg-gray-100 rounded-lg transition-colors text-xs flex items-center space-x-1"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Sửa</span>
                            </button>
                            <button
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs flex items-center space-x-1"
                              title="Xóa địa chỉ"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Xóa</span>
                            </button>
                          </div>
                        </div>

                        {!addr.isDefault && (
                          <div className="pt-2 mt-2 border-t border-gray-100 flex justify-end">
                            <button
                              onClick={() => handleSetDefaultAddress(addr.id)}
                              className="text-[11px] font-semibold text-primary-700 hover:underline"
                            >
                              Thiết lập làm địa chỉ mặc định
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 3: ORDERS */}
          {activeTab === 'orders' && (
            <Card className="shadow-sm">
              <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center space-x-2">
                  <Package className="h-5 w-5 text-primary-600" />
                  <span>Lịch Sử Đơn Hàng Mùa Vụ</span>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadOrders}
                  disabled={isLoadingOrders}
                  className="text-xs space-x-1"
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                  <span>Làm mới</span>
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoadingOrders ? (
                  <div className="space-y-4">
                    <Skeleton className="h-28 w-full rounded-xl" />
                    <Skeleton className="h-28 w-full rounded-xl" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 space-y-3">
                    <Package className="h-10 w-10 text-gray-300 mx-auto" />
                    <p className="text-xs">
                      Quý khách chưa có đơn đặt hàng phân bón nào trong hệ thống.
                    </p>
                    <Link href="/san-pham">
                      <Button variant="outline" size="sm" className="text-xs">
                        Khám phá danh mục phân bón
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                      >
                        {/* Order Card Header */}
                        <div className="bg-gray-50 p-3 sm:p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-black text-primary-800 text-sm">
                                {order.orderNumber}
                              </span>
                              <span className="text-gray-400">|</span>
                              <span className="text-gray-500">
                                {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-[11px] text-gray-500">
                              <span>Phương thức: {order.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản VietQR' : 'Tiền mặt (COD)'}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {/* Order Status Badge */}
                            {order.status === 'PENDING' && (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                                Chờ xác nhận
                              </Badge>
                            )}
                            {order.status === 'CONFIRMED' && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-900 border-blue-300 text-[10px]">
                                Đã xác nhận
                              </Badge>
                            )}
                            {order.status === 'PROCESSING' && (
                              <Badge variant="secondary" className="bg-indigo-100 text-indigo-900 border-indigo-300 text-[10px]">
                                Đang đóng gói
                              </Badge>
                            )}
                            {order.status === 'SHIPPING' && (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-900 border-purple-300 text-[10px]">
                                Đang giao hàng
                              </Badge>
                            )}
                            {order.status === 'COMPLETED' && (
                              <Badge variant="default" className="bg-emerald-700 text-white text-[10px]">
                                Hoàn tất
                              </Badge>
                            )}
                            {order.status === 'CANCELLED' && (
                              <Badge variant="destructive" className="text-[10px]">
                                Đã hủy
                              </Badge>
                            )}

                            {/* Payment Status Badge */}
                            <Badge
                              variant={order.paymentStatus === 'PAID' ? 'default' : 'secondary'}
                              className="text-[10px]"
                            >
                              {order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                            </Badge>
                          </div>
                        </div>

                        {/* Order Items List */}
                        <div className="p-3 sm:p-4 divide-y divide-gray-100 text-xs">
                          {order.items && order.items.length > 0 ? (
                            order.items.map((item) => (
                              <div key={item.id} className="py-2 first:pt-0 flex justify-between items-center">
                                <div className="space-y-0.5">
                                  <h5 className="font-semibold text-gray-900">
                                    {item.productName}
                                  </h5>
                                  <p className="text-gray-500 text-[11px]">
                                    Quy cách: {item.variantName} &bull; Số lượng: {item.quantity} bao
                                  </p>
                                </div>
                                <div className="text-right font-bold text-gray-900">
                                  {formatCurrencyVND(Number(item.lineTotal))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-gray-500 italic py-2">Chi tiết mặt hàng đang được đồng bộ...</p>
                          )}
                        </div>

                        {/* Order Footer & Actions */}
                        <div className="bg-gray-50/70 p-3 sm:p-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div>
                            {order.shippingAddress && (
                              <p className="text-[11px] text-gray-600">
                                <span className="font-semibold">Giao tới:</span> {order.shippingAddress.recipientName} ({order.shippingAddress.phone}) &bull; {order.shippingAddress.addressLine}, {order.shippingAddress.wardName}, {order.shippingAddress.districtName}, {order.shippingAddress.provinceName}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center space-x-3 ml-auto">
                            <div className="text-right">
                              <span className="text-[11px] text-gray-500 block">Tổng thanh toán:</span>
                              <span className="font-black text-primary-800 text-sm sm:text-base">
                                {formatCurrencyVND(Number(order.totalAmount))}
                              </span>
                            </div>

                            {order.status === 'PENDING' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={cancellingOrderId === order.id}
                                onClick={() => handleCancelOrder(order.id, order.orderNumber)}
                                className="text-xs"
                              >
                                {cancellingOrderId === order.id ? 'Đang hủy...' : 'Hủy Đơn'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ADDRESS MODAL */}
      {addressModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                <Building className="h-4 w-4 text-primary-600" />
                <span>
                  {editingAddressId
                    ? 'Chỉnh Sửa Địa Chỉ Nhận Hàng'
                    : 'Thêm Địa Chỉ Nhận Hàng Mới'}
                </span>
              </h3>
              <button
                onClick={() => setAddressModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAddress} className="p-6 space-y-4">
              {addressFormError && (
                <div className="p-3 bg-red-50 text-red-800 rounded-lg text-xs flex items-center space-x-2 border border-red-200">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{addressFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Người nhận <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="VD: Nguyễn Văn Nông"
                    required
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="VD: 0912345678"
                    required
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cascading Vietnam Divisions */}
              <div className="space-y-3 pt-1">
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
                    required
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="">-- Chọn Tỉnh / Thành phố --</option>
                    {provinces.map((prov) => (
                      <option key={prov.code} value={prov.code}>
                        {prov.name}
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
                      required
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Chọn Quận / Huyện --</option>
                      {districts.map((dist) => (
                        <option key={dist.code} value={dist.code}>
                          {dist.name}
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
                      required
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Chọn Phường / Xã --</option>
                      {wards.map((ward) => (
                        <option key={ward.code} value={ward.code}>
                          {ward.name}
                        </option>
                      ))}
                    </select>
                  </div>
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
                  placeholder="VD: Thôn 2, Xứ đồng Cánh Đông (Gần cầu Kênh 5)"
                  required
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefaultCheckbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <label
                  htmlFor="isDefaultCheckbox"
                  className="text-xs text-gray-700 select-none cursor-pointer"
                >
                  Đặt làm địa chỉ nhận phân bón mặc định
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddressModalOpen(false)}
                  className="text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingAddress}
                  size="sm"
                  className="text-xs font-semibold px-4"
                >
                  {isSavingAddress ? 'Đang lưu...' : 'Lưu Địa Chỉ'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-12 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <AccountContent />
    </Suspense>
  );
}

