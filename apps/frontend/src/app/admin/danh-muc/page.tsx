'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  FolderTree,
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

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  status: string;
  sortOrder: number;
}

const categorySchema = z.object({
  name: z.string().min(2, 'Tên danh mục bắt buộc tối thiểu 2 ký tự'),
  slug: z.string().min(2, 'Slug bắt buộc tối thiểu 2 ký tự'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      parentId: '',
      sortOrder: 0,
    },
  });

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient<Category[]>('/categories');
      if (res.success && res.data) {
        setCategories(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFeedback(null);
    reset({
      name: '',
      slug: '',
      description: '',
      parentId: '',
      sortOrder: 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFeedback(null);
    setValue('name', cat.name);
    setValue('slug', cat.slug);
    setValue('description', cat.description || '');
    setValue('parentId', cat.parentId || '');
    setValue('sortOrder', cat.sortOrder || 0);
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

  const onSubmit = async (values: CategoryFormValues) => {
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const payload: {
        name: string;
        slug: string;
        description: string | null;
        parentId: string | null;
        sortOrder: number;
      } = {
        name: values.name,
        slug: values.slug || generateSlug(values.name),
        description: values.description || null,
        parentId: values.parentId && values.parentId.trim() ? values.parentId.trim() : null,
        sortOrder: values.sortOrder || 0,
      };

      let res;
      if (editingCategory) {
        res = await apiClient(`/categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
          requireAuth: true,
        });
      } else {
        res = await apiClient('/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
          requireAuth: true,
        });
      }

      if (res.success) {
        setFeedback({
          type: 'success',
          message: editingCategory ? 'Cập nhật danh mục thành công!' : 'Tạo mới danh mục thành công!',
        });
        await loadCategories();
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

  const filteredCategories = categories.filter((c) =>
    searchTerm.trim()
      ? c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchTerm.toLowerCase())
      : true,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
            <FolderTree className="h-6 w-6 text-primary-600" />
            <span>Danh Mục & Nhóm Phân Bón</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Quản lý cây phân cấp danh mục phân bón cha-con (NPK, Hữu cơ, Đạm, Lân, Vi lượng...).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadCategories()}
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
            <span>Thêm danh mục</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm danh mục theo tên hoặc slug..."
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
                <TableHead className="text-xs font-semibold">Tên Danh Mục</TableHead>
                <TableHead className="text-xs font-semibold">Slug</TableHead>
                <TableHead className="text-xs font-semibold">Mô Tả</TableHead>
                <TableHead className="text-xs font-semibold">Danh Mục Cha (Parent ID)</TableHead>
                <TableHead className="text-xs font-semibold text-center">Thứ Tự</TableHead>
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
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-gray-500">
                    Chưa có danh mục nào.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCategories.map((c) => (
                  <TableRow key={c.id} className="hover:bg-gray-50/60">
                    <TableCell className="text-xs font-bold text-gray-900">
                      {c.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary-700">
                      {c.slug}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 max-w-xs truncate">
                      {c.description || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 font-mono">
                      {c.parentId || 'Gốc (Root)'}
                    </TableCell>
                    <TableCell className="text-center text-xs font-semibold text-gray-700">
                      {c.sortOrder}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="success" className="text-[10px]">
                        {c.status || 'ACTIVE'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(c)}
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
                <FolderTree className="h-5 w-5 text-primary-600" />
                <span>{editingCategory ? 'Chỉnh Sửa Danh Mục' : 'Thêm Mới Danh Mục'}</span>
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
                  Tên danh mục <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('name')}
                  placeholder="Ví dụ: Phân Bón Hữu Cơ Sinh Học"
                  onChange={(e) => {
                    register('name').onChange(e);
                    if (!editingCategory) {
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
                  placeholder="phan-bon-huu-co-sinh-hoc"
                  className="text-xs font-mono"
                />
                {errors.slug && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.slug.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Danh mục cha (Tùy chọn)
                </label>
                <select
                  {...register('parentId')}
                  className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-600"
                >
                  <option value="">-- Là danh mục gốc (Root) --</option>
                  {categories
                    .filter((c) => !editingCategory || c.id !== editingCategory.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Mô tả danh mục
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Mô tả công dụng, cây trồng mục tiêu..."
                  className="w-full rounded-md border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-primary-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Thứ tự sắp xếp
                </label>
                <Input
                  type="number"
                  {...register('sortOrder')}
                  className="text-xs"
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
                  {isSubmitting ? 'Đang lưu...' : editingCategory ? 'Lưu thay đổi' : 'Tạo danh mục'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
