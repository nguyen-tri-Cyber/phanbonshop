'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Newspaper,
  PlusCircle,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Calendar,
  Eye,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
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

interface PostItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const postSchema = z.object({
  title: z.string().min(3, 'Tiêu đề bài viết phải có ít nhất 3 ký tự'),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().min(10, 'Nội dung bài viết phải có ít nhất 10 ký tự'),
  coverImageUrl: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  publishedAt: z.string().optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingPost, setEditingPost] = useState<PostItem | null>(null);
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
  } = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      status: 'PUBLISHED',
    },
  });

  const coverImageUrlWatch = watch('coverImageUrl');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '10');
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await apiClient<{
        items: PostItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/posts/admin?${params.toString()}`);

      if (res.success && res.data) {
        setPosts(res.data.items);
        setTotalPages(res.data.totalPages);
        setTotalCount(res.data.total);
      } else if (!res.success) {
        setFeedback({ type: 'error', message: res.error?.message || 'Không thể tải danh sách bài viết' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi tải danh sách bài viết' });
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, statusFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleOpenCreate = () => {
    setEditingPost(null);
    reset({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      coverImageUrl: '',
      status: 'PUBLISHED',
      seoTitle: '',
      seoDescription: '',
      publishedAt: new Date().toISOString().slice(0, 16),
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (p: PostItem) => {
    setEditingPost(p);
    reset({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt || '',
      content: p.content,
      coverImageUrl: p.coverImageUrl || '',
      status: p.status,
      seoTitle: p.seoTitle || '',
      seoDescription: p.seoDescription || '',
      publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 16) : '',
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
      const response = await fetch('http://localhost:8080/api/v1/posts/upload-image', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const json = await response.json();
      if (response.ok && json.data?.url) {
        setValue('coverImageUrl', json.data.url);
        setFeedback({ type: 'success', message: 'Upload ảnh bìa lên MinIO thành công' });
      } else {
        setFeedback({ type: 'error', message: json.message || 'Upload ảnh thất bại' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi tải ảnh lên MinIO' });
    } finally {
      setUploadingImage(false);
    }
  };

  const onSubmit = async (values: PostFormValues) => {
    try {
      const payload = {
        ...values,
        publishedAt: values.publishedAt ? new Date(values.publishedAt).toISOString() : undefined,
      };

      if (editingPost) {
        const res = await apiClient(`/posts/${editingPost.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        if (res.success) {
          setFeedback({ type: 'success', message: 'Cập nhật bài viết thành công' });
          setModalOpen(false);
          fetchPosts();
        } else {
          setFeedback({ type: 'error', message: res.error?.message || 'Cập nhật bài viết thất bại' });
        }
      } else {
        const res = await apiClient('/posts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (res.success) {
          setFeedback({ type: 'success', message: 'Tạo bài viết mới thành công' });
          setModalOpen(false);
          fetchPosts();
        } else {
          setFeedback({ type: 'error', message: res.error?.message || 'Tạo bài viết thất bại' });
        }
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi hệ thống khi lưu bài viết' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiClient(`/posts/${id}`, {
        method: 'DELETE',
      });

      if (res.success) {
        setFeedback({ type: 'success', message: 'Đã xóa bài viết thành công' });
        setDeleteConfirmId(null);
        fetchPosts();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Xóa bài viết thất bại' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi khi xóa bài viết' });
    }
  };

  const getStatusBadge = (status: PostItem['status']) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge variant="success">Đã xuất bản</Badge>;
      case 'DRAFT':
        return <Badge variant="warning">Bản nháp</Badge>;
      case 'SCHEDULED':
        return <Badge variant="info">Đã lên lịch</Badge>;
      case 'ARCHIVED':
        return <Badge variant="outline">Lưu trữ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Newspaper className="h-6 w-6 text-primary-600" />
            <h1 className="text-xl font-bold text-gray-900">Quản Lý Bài Viết & Kiến Thức Nông Nghiệp</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Đăng tải cẩm nang kỹ thuật, hướng dẫn bón phân và tin tức nông vụ cho bà con nông dân.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPosts()}
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
            <span>Tạo Bài Viết Mới</span>
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

      {/* Filter / Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tiêu đề bài viết hoặc trích dẫn..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-xs text-gray-500 font-medium">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md text-xs px-2.5 py-1.5 bg-white focus:outline-none focus:border-primary-600"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PUBLISHED">Đã xuất bản (PUBLISHED)</option>
              <option value="DRAFT">Bản nháp (DRAFT)</option>
              <option value="SCHEDULED">Đã lên lịch (SCHEDULED)</option>
              <option value="ARCHIVED">Lưu trữ (ARCHIVED)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Posts Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-16 text-center">Ảnh</TableHead>
                <TableHead>Tiêu Đề & Đường Dẫn</TableHead>
                <TableHead className="w-32">Trạng Thái</TableHead>
                <TableHead className="w-40">Ngày Đăng</TableHead>
                <TableHead className="w-32 text-right">Thao Tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-10 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48 mb-2" /><Skeleton className="h-3 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : posts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-gray-500 text-xs">
                    Không tìm thấy bài viết nào phù hợp
                  </TableCell>
                </TableRow>
              ) : (
                posts.map((post) => (
                  <TableRow key={post.id} className="hover:bg-gray-50/80">
                    <TableCell className="text-center">
                      {post.coverImageUrl ? (
                        <img
                          src={post.coverImageUrl}
                          alt={post.title}
                          className="h-10 w-10 object-cover rounded shadow-sm inline-block"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-primary-100 text-primary-700 rounded flex items-center justify-center font-bold text-xs mx-auto">
                          <FileText className="h-5 w-5" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs text-gray-900 line-clamp-1">
                        {post.title}
                      </div>
                      <div className="text-[11px] text-gray-500 line-clamp-1 font-mono mt-0.5">
                        /kien-thuc/{post.slug}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(post.status)}</TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {post.publishedAt ? (
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          <span>{new Date(post.publishedAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Chưa lên lịch</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {post.status === 'PUBLISHED' && (
                          <Link
                            href={`/kien-thuc/${post.slug}`}
                            target="_blank"
                            className="p-1.5 text-gray-500 hover:text-primary-600 rounded hover:bg-gray-100"
                            title="Xem trên web"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(post)}
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(post.id)}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Hiển thị trang <span className="font-semibold">{page}</span> / {totalPages} (Tổng {totalCount} bài viết)
              </div>
              <div className="flex space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="text-xs"
                >
                  Trang Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="text-xs"
                >
                  Trang Kế
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                {editingPost ? 'Cập Nhật Bài Viết Kiến Thức' : 'Soạn Thảo Bài Viết Mới'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tiêu Đề Bài Viết <span className="text-red-500">*</span>
                </label>
                <Input
                  {...register('title')}
                  placeholder="Ví dụ: Kỹ thuật bón phân NPK chuyên dùng cho lúa vụ Đông Xuân"
                  className="text-xs"
                />
                {errors.title && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.title.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Đường dẫn thân thiện (Slug - Tùy chọn)
                  </label>
                  <Input
                    {...register('slug')}
                    placeholder="ky-thuat-bon-phan-npk-lua-dong-xuan"
                    className="text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Trạng Thái Xuất Bản <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('status')}
                    className="w-full border border-gray-300 rounded-md text-xs px-3 py-2 bg-white focus:outline-none focus:border-primary-600"
                  >
                    <option value="PUBLISHED">Xuất bản ngay (PUBLISHED)</option>
                    <option value="DRAFT">Lưu nháp (DRAFT)</option>
                    <option value="SCHEDULED">Lên lịch (SCHEDULED)</option>
                    <option value="ARCHIVED">Lưu trữ (ARCHIVED)</option>
                  </select>
                </div>
              </div>

              {/* Cover Image Upload MinIO */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ảnh Bìa Bài Viết (MinIO Storage)
                </label>
                <div className="flex items-center space-x-3">
                  <Input
                    {...register('coverImageUrl')}
                    placeholder="URL ảnh hoặc tải file bên cạnh..."
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
                {coverImageUrlWatch && (
                  <div className="mt-2 relative w-32 aspect-video rounded border overflow-hidden">
                    <img src={coverImageUrlWatch} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Đoạn Trích Dẫn Ngắn (Excerpt)
                </label>
                <textarea
                  {...register('excerpt')}
                  rows={2}
                  placeholder="Tóm tắt ngắn gọn 1-2 câu về nội dung bài viết..."
                  className="w-full border border-gray-300 rounded-md text-xs p-2.5 focus:outline-none focus:border-primary-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nội Dung Bài Viết Chi Tiết <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('content')}
                  rows={8}
                  placeholder="Nhập toàn bộ nội dung hướng dẫn, công thức bón và kỹ thuật canh tác..."
                  className="w-full border border-gray-300 rounded-md text-xs p-2.5 focus:outline-none focus:border-primary-600 font-sans leading-relaxed"
                />
                {errors.content && (
                  <p className="text-[11px] text-red-500 mt-1">{errors.content.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    SEO Title (Tiêu đề Google tìm kiếm)
                  </label>
                  <Input {...register('seoTitle')} placeholder="Mặc định lấy tiêu đề bài viết" className="text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Thời Gian Xuất Bản (Published At)
                  </label>
                  <Input {...register('publishedAt')} type="datetime-local" className="text-xs" />
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
                  Hủy Bỏ
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-primary-600 hover:bg-primary-700 text-xs"
                >
                  {isSubmitting ? 'Đang Lưu...' : editingPost ? 'Lưu Thay Đổi' : 'Tạo Bài Viết'}
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
              <h3 className="text-sm font-bold text-gray-900">Xác Nhận Xóa Bài Viết?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Hành động này không thể hoàn tác. Bài viết sẽ bị xóa vĩnh viễn khỏi hệ thống.
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
