'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  Plus,
  Trash2,
  Upload,
  Sparkles,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Boxes,
  FileText,
  Tag,
} from 'lucide-react';
import { apiClient, getAccessToken } from '../../../lib/api-client';
import { Category, Brand } from '../../../types/index';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Alert, AlertDescription } from '../../../components/ui/alert';

interface VariantFormItem {
  id: string;
  sku: string;
  unit: string;
  packageSize: string;
  price: number;
  compareAtPrice?: number;
  initialStock: number;
}

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateProductModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateProductModalProps) {
  // Master data
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState<boolean>(false);

  // Form State - Thông tin chung
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [compareAtPrice, setCompareAtPrice] = useState<number>(0);
  const [status, setStatus] = useState<'ACTIVE' | 'DRAFT'>('ACTIVE');
  const [featured, setFeatured] = useState<boolean>(false);
  const [bestSeller, setBestSeller] = useState<boolean>(false);

  // Form State - Kỹ thuật & Nông nghiệp
  const [shortDescription, setShortDescription] = useState('');
  const [composition, setComposition] = useState('');
  const [usageInstructions, setUsageInstructions] = useState('');
  const [cropTarget, setCropTarget] = useState('');

  // Form State - Quy cách & Tồn kho
  const [variants, setVariants] = useState<VariantFormItem[]>([
    {
      id: 'var-default',
      sku: '',
      unit: 'Bao',
      packageSize: '25kg',
      price: 0,
      initialStock: 50,
    },
  ]);

  // Form State - Ảnh
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Tải danh mục và thương hiệu khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    const loadMasterData = async () => {
      setIsLoadingMaster(true);
      try {
        const [catRes, brandRes] = await Promise.all([
          apiClient<Category[]>('/categories'),
          apiClient<Brand[]>('/brands'),
        ]);

        if (catRes.success && Array.isArray(catRes.data)) {
          setCategories(catRes.data);
          if (catRes.data.length > 0 && !categoryId) {
            setCategoryId(catRes.data[0].id);
          }
        }
        if (brandRes.success && Array.isArray(brandRes.data)) {
          setBrands(brandRes.data);
          if (brandRes.data.length > 0 && !brandId) {
            setBrandId(brandRes.data[0].id);
          }
        }
      } catch {
        // Ignore
      } finally {
        setIsLoadingMaster(false);
      }
    };

    loadMasterData();
  }, [isOpen]);

  // Tự động đồng bộ SKU biến thể khi SKU chính thay đổi
  const handleGenerateSku = () => {
    if (!name.trim()) return;
    const cleanStr = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .toUpperCase()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .join('-');
    const generatedSku = `${cleanStr}-${Math.floor(100 + Math.random() * 900)}`;
    setSku(generatedSku);

    // Cập nhật cho variant đầu tiên nếu chưa có
    setVariants((prev) =>
      prev.map((v) => ({
        ...v,
        sku: v.sku || `${generatedSku}-${v.packageSize.toUpperCase().replace(/\s+/g, '')}`,
      })),
    );
  };

  // Quản lý biến thể
  const handleAddVariant = () => {
    const nextSize = variants.length === 1 ? '50kg' : `${variants.length * 10}kg`;
    const newVariant: VariantFormItem = {
      id: `var-${Date.now()}`,
      sku: sku ? `${sku}-${nextSize.toUpperCase()}` : '',
      unit: 'Bao',
      packageSize: nextSize,
      price: price > 0 ? price : 0,
      initialStock: 20,
    };
    setVariants([...variants, newVariant]);
  };

  const handleRemoveVariant = (id: string) => {
    if (variants.length <= 1) return;
    setVariants(variants.filter((v) => v.id !== id));
  };

  const handleUpdateVariant = (
    id: string,
    field: keyof VariantFormItem,
    value: unknown,
  ) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)),
    );
  };

  // Chọn ảnh
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Submit form tạo sản phẩm
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation cơ bản
    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên sản phẩm phân bón');
      return;
    }
    if (!sku.trim()) {
      setErrorMsg('Vui lòng nhập hoặc tự sinh mã SKU chính');
      return;
    }
    if (price <= 0) {
      setErrorMsg('Vui lòng nhập giá bán hợp lệ (> 0đ)');
      return;
    }

    // Đảm bảo các biến thể có SKU và giá
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.sku.trim()) {
        setErrorMsg(`Quy cách thứ ${i + 1} (${v.packageSize}) chưa có mã SKU`);
        return;
      }
      if (v.price <= 0) {
        setErrorMsg(`Quy cách thứ ${i + 1} (${v.packageSize}) cần có giá bán > 0đ`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // 1. Tạo sản phẩm và biến thể qua product-service
      const productPayload = {
        name: name.trim(),
        sku: sku.trim(),
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        price: Number(price),
        compareAtPrice: compareAtPrice > 0 ? Number(compareAtPrice) : undefined,
        status,
        featured,
        bestSeller,
        shortDescription: shortDescription.trim() || undefined,
        composition: composition.trim() || undefined,
        usageInstructions: usageInstructions.trim() || undefined,
        variants: variants.map((v) => ({
          sku: v.sku.trim(),
          unit: v.unit.trim(),
          packageSize: v.packageSize.trim(),
          price: Number(v.price),
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
          status: 'ACTIVE',
        })),
        agriculturalAttrs: cropTarget.trim()
          ? [
              {
                attributeType: 'CROP',
                value: cropTarget.trim(),
              },
            ]
          : undefined,
      };

      const res = await apiClient<{
        id: string;
        name: string;
        sku: string;
        variants?: { id: string; sku: string }[];
      }>('/products', {
        method: 'POST',
        requireAuth: true,
        body: JSON.stringify(productPayload),
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Không thể tạo sản phẩm');
      }

      const createdProduct = res.data;

      // 2. Upload ảnh nếu có
      if (imageFile) {
        try {
          const formData = new FormData();
          formData.append('file', imageFile);
          formData.append('altText', name.trim());

          const uploadUrl = `/api/v1/products/${createdProduct.id}/images/upload`;
          const token = getAccessToken();
          await fetch(uploadUrl, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });
        } catch (imgErr) {
          console.warn('Lỗi tải ảnh (sản phẩm vẫn tạo thành công):', imgErr);
        }
      }

      // 3. Tự động khởi tạo tồn kho cho các biến thể nếu có initialStock > 0
      if (createdProduct.variants && createdProduct.variants.length > 0) {
        for (const createdVariant of createdProduct.variants) {
          const formVariant = variants.find(
            (v) => v.sku.trim().toLowerCase() === createdVariant.sku.toLowerCase(),
          );
          const initialQty = formVariant ? Number(formVariant.initialStock) : 0;

          if (initialQty > 0) {
            try {
              await apiClient('/inventory/adjust', {
                method: 'POST',
                requireAuth: true,
                body: JSON.stringify({
                  productId: createdProduct.id,
                  variantId: createdVariant.id,
                  quantityChange: initialQty,
                  reason: 'Khởi tạo tồn kho ban đầu khi thêm sản phẩm mới',
                  referenceType: 'INITIAL_STOCK',
                  referenceId: createdProduct.sku,
                }),
              });
            } catch (invErr) {
              console.warn('Lỗi khởi tạo tồn kho biến thể:', invErr);
            }
          }
        }
      }

      setSuccessMsg(`Đã thêm thành công sản phẩm: ${createdProduct.name} (${createdProduct.sku})`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tạo sản phẩm';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Thêm Mới Sản Phẩm Phân Bón</h2>
              <p className="text-xs text-gray-500">
                Nhập thông tin sản phẩm, quy cách đóng gói và khởi tạo tồn kho
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="py-2.5 border-emerald-300 bg-emerald-50 text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-xs font-semibold">{successMsg}</AlertDescription>
            </Alert>
          )}

          {/* Section 1: Thông tin cơ bản */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800 uppercase tracking-wider">
              <Tag className="h-4 w-4" />
              <span>1. Thông Tin Cơ Bản Sản Phẩm</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tên sản phẩm phân bón <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Ví dụ: Phân bón NPK Đầu Trâu 20-20-15+TE Cao Cấp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Mã SKU chính <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateSku}
                    className="text-[11px] text-emerald-600 hover:underline flex items-center space-x-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Tự sinh SKU</span>
                  </button>
                </div>
                <Input
                  placeholder="Ví dụ: DT-NPK-202015"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  className="text-xs font-mono uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Giá tham chiếu (VNĐ) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  placeholder="650000"
                  value={price || ''}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="text-xs font-semibold"
                  min={0}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Giá niêm yết / so sánh (VNĐ)
                </label>
                <Input
                  type="number"
                  placeholder="700000 (nếu có khuyến mãi)"
                  value={compareAtPrice || ''}
                  onChange={(e) => setCompareAtPrice(Number(e.target.value))}
                  className="text-xs"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nhóm / Danh mục phân bón
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  disabled={isLoadingMaster}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Thương hiệu / Nhà sản xuất
                </label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  disabled={isLoadingMaster}
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tóm tắt / Mô tả ngắn sản phẩm
                </label>
                <Input
                  placeholder="Ví dụ: Phân bón cao cấp kích ra hoa đậu trái, chống rụng hoa và rụng quả non"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Trạng thái & cờ nổi bật */}
            <div className="flex flex-wrap items-center gap-6 pt-2">
              <label className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={status === 'ACTIVE'}
                  onChange={(e) => setStatus(e.target.checked ? 'ACTIVE' : 'DRAFT')}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span>Kích hoạt bán ngay (ACTIVE)</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={bestSeller}
                  onChange={(e) => setBestSeller(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span>Gắn nhãn Bán chạy vụ mùa</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span>Sản phẩm nổi bật trang chủ</span>
              </label>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Section 2: Quy cách đóng gói & Tồn kho */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                <Boxes className="h-4 w-4" />
                <span>2. Quy Cách Đóng Gói & Tồn Kho Ban Đầu</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddVariant}
                className="text-xs space-x-1 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm quy cách</span>
              </Button>
            </div>

            <p className="text-[11px] text-gray-500">
              Khai báo các đơn vị đóng gói (Bao 25kg, Bao 50kg, Can 5L...) kèm tồn kho nhập ban đầu.
            </p>

            <div className="space-y-2.5">
              {variants.map((v) => (
                <div
                  key={v.id}
                  className="p-3 border border-gray-200 rounded-xl bg-gray-50/60 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                >
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      Đơn vị tính
                    </label>
                    <select
                      value={v.unit}
                      onChange={(e) => handleUpdateVariant(v.id, 'unit', e.target.value)}
                      className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="Bao">Bao</option>
                      <option value="Can">Can</option>
                      <option value="Chai">Chai</option>
                      <option value="Xô">Xô</option>
                      <option value="Gói">Gói</option>
                      <option value="Tấn">Tấn</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      Quy cách
                    </label>
                    <Input
                      placeholder="Ví dụ: 25kg"
                      value={v.packageSize}
                      onChange={(e) => handleUpdateVariant(v.id, 'packageSize', e.target.value)}
                      className="text-xs bg-white py-1"
                      required
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      Mã SKU Biến Thể
                    </label>
                    <Input
                      placeholder="SKU-25KG"
                      value={v.sku}
                      onChange={(e) =>
                        handleUpdateVariant(v.id, 'sku', e.target.value.toUpperCase())
                      }
                      className="text-xs font-mono uppercase bg-white py-1"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">
                      Giá bán (đ)
                    </label>
                    <Input
                      type="number"
                      placeholder="650000"
                      value={v.price || ''}
                      onChange={(e) => handleUpdateVariant(v.id, 'price', Number(e.target.value))}
                      className="text-xs font-semibold bg-white py-1"
                      min={0}
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-emerald-800 mb-0.5">
                      Tồn kho ban đầu
                    </label>
                    <Input
                      type="number"
                      placeholder="50"
                      value={v.initialStock || ''}
                      onChange={(e) =>
                        handleUpdateVariant(v.id, 'initialStock', Number(e.target.value))
                      }
                      className="text-xs bg-white py-1 font-semibold text-emerald-700"
                      min={0}
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-center pb-0.5">
                    <button
                      type="button"
                      disabled={variants.length <= 1}
                      onClick={() => handleRemoveVariant(v.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-30"
                      title="Xóa quy cách này"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Section 3: Hướng dẫn kỹ thuật & Thành phần */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800 uppercase tracking-wider">
              <FileText className="h-4 w-4" />
              <span>3. Thông Số Kỹ Thuật & Khuyến Cáo Canh Tác</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Cây trồng khuyến cáo
                </label>
                <Input
                  placeholder="Ví dụ: Sầu riêng, Cà phê, Lúa vụ Đông Xuân, Cây ăn trái"
                  value={cropTarget}
                  onChange={(e) => setCropTarget(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Thành phần định lượng (N-P-K & Vi lượng)
                </label>
                <Input
                  placeholder="Ví dụ: Đạm (N): 20%, Lân (P2O5): 20%, Kali (K2O): 15%, Bo, Kẽm"
                  value={composition}
                  onChange={(e) => setComposition(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Hướng dẫn sử dụng & Liều lượng bón
                </label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Bón lót hoặc bón thúc nuôi trái. Liều lượng 200 - 350g/gốc hoặc 250kg/ha tùy giai đoạn phát triển..."
                  value={usageInstructions}
                  onChange={(e) => setUsageInstructions(e.target.value)}
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Section 4: Ảnh sản phẩm */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-gray-700">
              Ảnh đại diện sản phẩm (Tải lên MinIO)
            </label>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                  id="product-image-upload"
                />
                <label
                  htmlFor="product-image-upload"
                  className="cursor-pointer inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <Upload className="h-4 w-4 text-gray-500" />
                  <span>{imageFile ? 'Đổi ảnh khác' : 'Chọn tệp hình ảnh'}</span>
                </label>
              </div>

              {imagePreview ? (
                <div className="flex items-center space-x-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-14 w-14 object-cover rounded-xl border border-gray-200"
                  />
                  <span className="text-[11px] text-gray-500 truncate max-w-[200px]">
                    {imageFile?.name}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-gray-400 italic">
                  Chấp nhận định dạng JPG, PNG, WEBP (Khuyến nghị tỷ lệ vuông 1:1)
                </span>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs space-x-1.5 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang lưu sản phẩm & tạo kho...</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                <span>Lưu & Bắt Đầu Bán</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
