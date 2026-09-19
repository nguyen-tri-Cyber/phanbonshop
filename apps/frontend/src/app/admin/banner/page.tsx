'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Image as ImageIcon,
  PlusCircle,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ExternalLink,
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

interface BannerItem {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl: string | null;
  position: string;
  startAt: string | null;
  endAt: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const bannerSchema = z.object({
  title: z.string().min(2, 'Tiêu đề banner phải có ít nhất 2 ký tự'),
  imageUrl: z.string().url('URL hình ảnh không hợp lệ'),
  targetUrl: z.string().optional(),
  position: z.enum([
    'HOME_HERO',
    'HOME_MIDDLE',
    'SIDEBAR',
    'POPUP',
    'CATEGORY_HEADER',
  ]),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  sortOrder: z.coerce.number().default(0),
});

type BannerFormValues = z.infer<typeof bannerSchema>;

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BannerFormValues>({
    resolver: zodResolver(bannerSchema),
    defaultValues: {
      position: 'HOME_HERO',
      status: 'ACTIVE',
      sortOrder: 0,
    },
  });

  const imageUrlWatch = watch('imageUrl');

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (positionFilter !== 'ALL') params.append('position', positionFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await apiClient<BannerItem[]>(`/banners/admin?${params.toString()}`);
      if (res.success && Array.isArray(res.data)) {
        setBanners(res.data);
      } else if (!res.success) {
        setFeedback({ type: 'error', message: res.error?.message || 'Không thể tải danh sách banner' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi tải danh sách banner' });
    } finally {
      setLoading(false);
    }
  }, [positionFilter, statusFilter]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleOpenCreate = () => {
    setEditingBanner(null);
    reset({
      title: '',
      imageUrl: '',
      targetUrl: '',
      position: 'HOME_HERO',
      status: 'ACTIVE',
      sortOrder: 0,
      startAt: new Date().toISOString().slice(0, 16),
      endAt: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (b: BannerItem) => {
    setEditingBanner(b);
    reset({
      title: b.title,
      imageUrl: b.imageUrl,
      targetUrl: b.targetUrl || '',
      position: b.position as BannerFormValues['position'],
      status: b.status,
      sortOrder: b.sortOrder,
      startAt: b.startAt ? new Date(b.startAt).toISOString().slice(0, 16) : '',
      endAt: b.endAt ? new Date(b.endAt).toISOString().slice(0, 16) : '',
    });
    setModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
      const response = await fetch(`${apiUrl}/banners/upload-image`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const json = await response.json();
      if (response.ok && json.data?.url) {
        setValue('imageUrl', json.data.url);
        setFeedback({ type: 'success', message: 'Upload ảnh banner lên MinIO thành công' });
      } else {
        setFeedback({ type: 'error', message: json.message || 'Upload ảnh thất bại' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi khi upload ảnh banner' });
    } finally {
      setUploadingImage(false);
    }
  };

  const onSubmit = async (values: BannerFormValues) => {
    try {
      const payload = {
        ...values,
        startAt: values.startAt ? new Date(values.startAt).toISOString() : undefined,
        endAt: values.endAt ? new Date(values.endAt).toISOString() : undefined,
      };

      if (editingBanner) {
        const res = await apiClient(`/banners/${editingBanner.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        if (res.success) {
          setFeedback({ type: 'success', message: 'Cập nhật banner thành công' });
          setModalOpen(false);
          fetchBanners();
        } else {
          setFeedback({ type: 'error', message: res.error?.message || 'Cập nhật banner thất bại' });
        }
      } else {
        const res = await apiClient('/banners', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (res.success) {
          setFeedback({ type: 'success', message: 'Tạo banner mới thành công' });
          setModalOpen(false);
          fetchBanners();
        } else {
          setFeedback({ type: 'error', message: res.error?.message || 'Tạo banner thất bại' });
        }
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi lưu banner' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiClient(`/banners/${id}`, {
        method: 'DELETE',
      });

      if (res.success) {
        setFeedback({ type: 'success', message: 'Đã xóa banner thành công' });
        setDeleteConfirmId(null);
        fetchBanners();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Xóa banner thất bại' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi khi xóa banner' });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ImageIcon className="h-6 w-6 text-primary-600" />
            <h1 className="text-xl font-bold text-gray-900">Quản Lý Banner & Quảng Cáo</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Điều chỉnh hình ảnh hero trang chủ, banner khuyến mãi vụ mùa, popup và vị trí quảng bá sản phẩm.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchBanners()}
            disabled={loading}
            className="flex items-center space-x-1"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Tải Lại</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="flex items-center space-x-1.5 bg-primary-600 hover:bg-primary-700"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Thêm Banner Mới</span>
          </Button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {feedback && (
        <Alert variant={feedback.type === 'success' ? 'default' : 'destructive'} className="relative">
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className="text-xs">{feedback.message}</AlertDescription>
          <button
            onClick={() => setFeedback(null)}
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4 w-full sm:w-auto">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 font-medium">Vị trí:</span>
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="border border-gray-300 rounded-md text-xs px-2.5 py-1.5 bg-white focus:outline-none focus:border-primary-600"
              >
                <option value="ALL">Tất cả vị trí</option>
                <option value="HOME_HERO">Đầu trang chủ (HOME_HERO)</option>
                <option value="HOME_MIDDLE">Giữa trang chủ (HOME_MIDDLE)</option>
                <option value="SIDEBAR">Thanh bên (SIDEBAR)</option>
                <option value="POPUP">Cửa sổ bật (POPUP)</option>
                <option value="CATEGORY_HEADER">Đầu danh mục (CATEGORY_HEADER)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 font-medium">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md text-xs px-2.5 py-1.5 bg-white focus:outline-none focus:border-primary-600"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang kích hoạt (ACTIVE)</option>
                <option value="INACTIVE">Tắt (INACTIVE)</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Tổng số banner: <span className="font-bold text-gray-900">{banners.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Banners Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-24 text-center">Hình Ảnh</TableHead>
                <TableHead>Tiêu Đề & Vị Trí</TableHead>
                <TableHead className="w-48">Đích Đến (Target URL)</TableHead>
                <TableHead className="w-28 text-center">Thứ Tự</TableHead>
                <TableHead className="w-28 text-center">Trạng Thái</TableHead>
                <TableHead className="w-32 text-right">Thao Tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-12 w-20 rounded mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40 mb-2" /><Skeleton className="h-3 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : banners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-500 text-xs">
                    Chưa có banner nào phù hợp với bộ lọc
                  </TableCell>
                </TableRow>
              ) : (
                banners.map((banner) => (
                  <TableRow key={banner.id} className="hover:bg-gray-50/80">
                    <TableCell className="text-center">
                      <img
                        src={banner.imageUrl}
                        alt={banner.title}
                        className="h-12 w-20 object-cover rounded shadow-sm inline-block border border-gray-200"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs text-gray-900 line-clamp-1">
                        {banner.title}
                      </div>
                      <div className="mt-1 flex items-center space-x-1.5">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {banner.position}
                        </Badge>
                        {banner.startAt && (
                          <span className="text-[10px] text-gray-400">
                            Từ: {new Date(banner.startAt).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 truncate max-w-xs">
                      {banner.targetUrl ? (
                        <a
                          href={banner.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-600 hover:underline flex items-center space-x-1"
                        >
                          <span className="truncate">{banner.targetUrl}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-gray-400 italic">Không có</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs font-semibold text-gray-700">
                      {banner.sortOrder}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={banner.status === 'ACTIVE' ? 'success' : 'outline'}>
                        {banner.status === 'ACTIVE' ? 'Hoạt động' : 'Tắt'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(banner)}
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(banner.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                {editingBanner ? 'Cập Nhật Banner Quảng Cáo' : 'Thêm Banner Quảng Cáo Mới'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tiêu Đề Banner <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('title')}
                  placeholder="Ví dụ: Khuyến Mãi Phân Bón Vụ Đông Xuân 2026"
                  className="text-xs"
                />
                {errors.title && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.title.message}</p>
                )}
              </div>

              {/* Image URL & Upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Hình Ảnh Banner (MinIO Storage hoặc URL) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center space-x-3">
                  <Input
                    {...register('imageUrl')}
                    placeholder="https://... hoặc tải file bên cạnh"
                    className="text-xs flex-1"
                  />
                  <label className="inline-flex items-center space-x-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs font-medium cursor-pointer border border-gray-300">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploadingImage ? 'Đang tải...' : 'Tải File Lên'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>
                {errors.imageUrl && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.imageUrl.message}</p>
                )}
                {imageUrlWatch && (
                  <div className="mt-2 relative w-full h-32 rounded border overflow-hidden bg-gray-100">
                    <img src={imageUrlWatch} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Vị Trí Hiển Thị <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('position')}
                    className="w-full border border-gray-300 rounded-md text-xs px-3 py-2 bg-white focus:outline-none focus:border-primary-600"
                  >
                    <option value="HOME_HERO">Đầu trang chủ (HOME_HERO)</option>
                    <option value="HOME_MIDDLE">Giữa trang chủ (HOME_MIDDLE)</option>
                    <option value="SIDEBAR">Thanh bên (SIDEBAR)</option>
                    <option value="POPUP">Cửa sổ bật (POPUP)</option>
                    <option value="CATEGORY_HEADER">Đầu danh mục (CATEGORY_HEADER)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Trạng Thái <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('status')}
                    className="w-full border border-gray-300 rounded-md text-xs px-3 py-2 bg-white focus:outline-none focus:border-primary-600"
                  >
                    <option value="ACTIVE">Kích hoạt (ACTIVE)</option>
                    <option value="INACTIVE">Tắt (INACTIVE)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Đường Dẫn Đích Khi Nhấp (Target URL)
                  </label>
                  <Input
                    {...register('targetUrl')}
                    placeholder="/san-pham hoặc /kien-thuc/..."
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Thứ Tự Sắp Xếp (Sort Order)
                  </label>
                  <Input
                    type="number"
                    {...register('sortOrder')}
                    placeholder="0"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Thời Điểm Bắt Đầu (Tùy chọn)
                  </label>
                  <Input {...register('startAt')} type="datetime-local" className="text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Thời Điểm Kết Thúc (Tùy chọn)
                  </label>
                  <Input {...register('endAt')} type="datetime-local" className="text-xs" />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                  className="text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-primary-600 hover:bg-primary-700 text-xs"
                >
                  {isSubmitting ? 'Đang Lưu...' : editingBanner ? 'Lưu Thay Đổi' : 'Thêm Banner'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Xác Nhận Xóa Banner?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Banner sẽ bị xóa vĩnh viễn khỏi hệ thống hiển thị.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmId(null)}
                className="text-xs"
              >
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={() => handleDelete(deleteConfirmId)}
                className="bg-red-600 hover:bg-red-700 text-xs text-white"
              >
                Xác Nhận Xóa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
