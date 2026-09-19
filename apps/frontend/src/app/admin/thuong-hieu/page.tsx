'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Award,
  PlusCircle,
  RefreshCw,
  Edit2,
  X,
  Search,
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

interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  status: string;
}

const brandSchema = z.object({
  name: z.string().min(2, 'Tên thương hiệu bắt buộc tối thiểu 2 ký tự'),
  slug: z.string().min(2, 'Slug bắt buộc tối thiểu 2 ký tự'),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
});

type BrandFormValues = z.infer<typeof brandSchema>;

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<BrandFormValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      logoUrl: '',
    },
  });

  const loadBrands = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient<Brand[]>('/brands');
      if (res.success && res.data) {
        setBrands(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const openCreateModal = () => {
    setEditingBrand(null);
    setFeedback(null);
    reset({
      name: '',
      slug: '',
      description: '',
      logoUrl: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (brand: Brand) => {
    setEditingBrand(brand);
    setFeedback(null);
    setValue('name', brand.name);
    setValue('slug', brand.slug);
    setValue('description', brand.description || '');
    setValue('logoUrl', brand.logoUrl || '');
    setIsModalOpen(true);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  };

  const onSubmit = async (values: BrandFormValues) => {
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const payload: {
        name: string;
        slug: string;
        description: string | null;
        logoUrl: string | null;
      } = {
        name: values.name,
        slug: values.slug || generateSlug(values.name),
        description: values.description || null,
        logoUrl: values.logoUrl && values.logoUrl.trim() ? values.logoUrl.trim() : null,
      };

      let res;
      if (editingBrand) {
        res = await apiClient(`/brands/${editingBrand.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
          requireAuth: true,
        });
      } else {
        res = await apiClient('/brands', {
          method: 'POST',
          body: JSON.stringify(payload),
          requireAuth: true,
        });
      }

      if (res.success) {
        setFeedback({
          type: 'success',
          message: editingBrand ? 'Cập nhật thương hiệu thành công!' : 'Tạo mới thương hiệu thành công!',
        });
        await loadBrands();
        setTimeout(() => setIsModalOpen(false), 1200);
      } else {
        setFeedback({
          type: 'error',
          message: res.error?.message || 'Thao tác không thành công',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Lỗi hệ thống',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBrands = brands.filter((b) =>
    searchTerm.trim()
      ? b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.slug.toLowerCase().includes(searchTerm.toLowerCase())
      : true,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
            <Award className="h-6 w-6 text-primary-600" />
            <span>Thương Hiệu & Nhà Sản Xuất Phân Bón</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Quản lý các hãng sản xuất phân bón uy tín trong và ngoài nước (Cà Mau, Phú Mỹ, Bình Điền, Đầu Trâu, Yara...).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadBrands()}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
          <Button
            size="sm"
            onClick={openCreateModal}
            className="text-xs space-x-1.5 shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Thêm thương hiệu</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm thương hiệu theo tên hoặc slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70">
                <TableHead className="text-xs font-semibold">Tên Thương Hiệu</TableHead>
                <TableHead className="text-xs font-semibold">Slug</TableHead>
                <TableHead className="text-xs font-semibold">Mô Tả / Xuất Xứ</TableHead>
                <TableHead className="text-xs font-semibold text-center">Trạng Thái</TableHead>
                <TableHead className="text-xs font-semibold text-center">Thao Tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-xs text-gray-500">
                    Chưa có thương hiệu nào.
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrands.map((b) => (
                  <TableRow key={b.id} className="hover:bg-gray-50/60">
                    <TableCell className="text-xs font-bold text-gray-900">
                      {b.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary-700">
                      {b.slug}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 max-w-sm truncate">
                      {b.description || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="success" className="text-[10px]">
                        {b.status || 'ACTIVE'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(b)}
                        className="text-xs h-8 px-2.5"
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1 text-primary-600" />
                        Sửa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                <Award className="h-5 w-5 text-primary-600" />
                <span>{editingBrand ? 'Chỉnh Sửa Thương Hiệu' : 'Thêm Mới Thương Hiệu'}</span>
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

            <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Tên thương hiệu <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('name')}
                  placeholder="Ví dụ: Đạm Cà Mau"
                  onChange={(e) => {
                    register('name').onChange(e);
                    if (!editingBrand) {
                      setValue('slug', generateSlug(e.target.value));
                    }
                  }}
                  className="text-xs"
                />
                {errors.name && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Slug (Đường dẫn thân thiện) <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('slug')}
                  placeholder="dam-ca-mau"
                  className="text-xs font-mono"
                />
                {errors.slug && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.slug.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Logo URL (Tùy chọn)
                </label>
                <Input
                  {...register('logoUrl')}
                  placeholder="https://..."
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Mô tả / Xuất xứ
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Công ty CP Phân bón Dầu khí Cà Mau..."
                  className="w-full rounded-md border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-primary-600 focus:outline-none"
                />
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
                  {isSubmitting ? 'Đang lưu...' : editingBrand ? 'Lưu thay đổi' : 'Tạo thương hiệu'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
