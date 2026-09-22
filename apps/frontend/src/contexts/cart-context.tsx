'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { CartItem, Cart } from '../types/index';
import { useAuth } from './auth-context';
import { apiClient } from '../lib/api-client';

const MAX_ITEM_QUANTITY = 99;

export interface ChangeVariantParams {
  variantId: string;
  sku: string;
  packageSize: string;
  price: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  changeVariant: (oldVariantId: string, newVariant: ChangeVariantParams) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isLoading: boolean;
  error: string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydratedOwner, setHydratedOwner] = useState<string | null | undefined>(undefined);

  const prevUserRef = useRef<string | null | undefined>(undefined);

  // Sync / Load cart depending on auth state
  const loadCart = useCallback(async () => {
    if (isAuthLoading) return;
    setError(null);

    if (user) {
      setIsLoading(true);
      try {
        // Kiểm tra xem có guest items trong localStorage không
        let guestItems: CartItem[] = [];
        try {
          const saved = localStorage.getItem('phanbon_cart');
          if (saved) {
            guestItems = JSON.parse(saved);
          }
        } catch {
          // ignore
        }

        if (guestItems && guestItems.length > 0) {
          // Gửi merge lên backend
          const mergeRes = await apiClient<Cart>('/cart/merge', {
            method: 'POST',
            requireAuth: true,
            body: JSON.stringify({
              items: guestItems.map((i) => ({
                variantId: i.variantId,
                productId: i.productId,
                productName: i.productName,
                productSlug: i.productSlug,
                sku: i.sku,
                packageSize: i.packageSize,
                price: i.price,
                quantity: i.quantity,
                imageUrl: i.imageUrl,
              })),
            }),
          });

          if (mergeRes.success && mergeRes.data) {
            localStorage.removeItem('phanbon_cart');
            setItems(mergeRes.data.items || []);
          } else {
            setError(
              !mergeRes.success
                ? mergeRes.error.message
                : 'Không thể đồng bộ giỏ hàng. Vui lòng thử lại.',
            );
            // Fallback load regular cart
            const res = await apiClient<Cart>('/cart', { requireAuth: true });
            if (res.success && res.data) {
              setItems(res.data.items || []);
            }
          }
        } else {
          // Không có guest items, tải giỏ hàng authenticated bình thường
          const res = await apiClient<Cart>('/cart', { requireAuth: true });
          if (res.success && res.data) {
            setItems(res.data.items || []);
          }
        }
      } catch (err) {
        console.error('Failed to load authenticated cart:', err);
      } finally {
        setIsLoading(false);
        setHydratedOwner(user.id);
      }
    } else {
      // Guest mode
      try {
        const saved = localStorage.getItem('phanbon_cart');
        if (saved) {
          setItems(JSON.parse(saved));
        } else {
          setItems([]);
        }
      } catch {
        setItems([]);
      }
      setHydratedOwner(null);
    }
  }, [user, isAuthLoading]);

  // Effect chạy khi user thay đổi trạng thái (login/logout/mount)
  useEffect(() => {
    if (isAuthLoading) return;
    const currentUserId = user ? user.id : null;
    if (prevUserRef.current !== currentUserId) {
      prevUserRef.current = currentUserId;
      loadCart();
    }
  }, [user, isAuthLoading, loadCart]);

  // Lưu vào localStorage khi items thay đổi VÀ đang ở chế độ GUEST
  useEffect(() => {
    if (!isAuthLoading && !user && hydratedOwner === null) {
      try {
        localStorage.setItem('phanbon_cart', JSON.stringify(items));
      } catch {
        // Ignore
      }
    }
  }, [items, user, isAuthLoading, hydratedOwner]);

  const addItem = async (item: CartItem) => {
    const clampedQty = Math.min(Math.max(1, item.quantity), MAX_ITEM_QUANTITY);

    if (user) {
      setIsLoading(true);
      try {
        const res = await apiClient<Cart>('/cart/items', {
          method: 'POST',
          requireAuth: true,
          body: JSON.stringify({
            variantId: item.variantId,
            productId: item.productId,
            productName: item.productName,
            productSlug: item.productSlug,
            sku: item.sku,
            packageSize: item.packageSize,
            price: item.price,
            quantity: clampedQty,
            imageUrl: item.imageUrl,
          }),
        });
        if (res.success && res.data) {
          setItems(res.data.items || []);
        }
      } catch (err) {
        console.error('Error adding item to auth cart:', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Guest local
      setItems((prev) => {
        const existing = prev.find((i) => i.variantId === item.variantId);
        if (existing) {
          const newQty = Math.min(existing.quantity + clampedQty, MAX_ITEM_QUANTITY);
          return prev.map((i) => (i.variantId === item.variantId ? { ...i, quantity: newQty } : i));
        }
        return [...prev, { ...item, quantity: clampedQty }];
      });
    }
    setIsOpen(true);
  };

  const removeItem = async (variantId: string) => {
    if (user) {
      setIsLoading(true);
      try {
        const res = await apiClient<Cart>(`/cart/items/${variantId}`, {
          method: 'DELETE',
          requireAuth: true,
        });
        if (res.success && res.data) {
          setItems(res.data.items || []);
        }
      } catch (err) {
        console.error('Error removing item from auth cart:', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setItems((prev) => prev.filter((i) => i.variantId !== variantId));
    }
  };

  const updateQuantity = async (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(variantId);
      return;
    }

    const clampedQty = Math.min(quantity, MAX_ITEM_QUANTITY);

    if (user) {
      setIsLoading(true);
      try {
        const res = await apiClient<Cart>(`/cart/items/${variantId}`, {
          method: 'PUT',
          requireAuth: true,
          body: JSON.stringify({ quantity: clampedQty }),
        });
        if (res.success && res.data) {
          setItems(res.data.items || []);
        }
      } catch (err) {
        console.error('Error updating quantity in auth cart:', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setItems((prev) =>
        prev.map((i) => (i.variantId === variantId ? { ...i, quantity: clampedQty } : i)),
      );
    }
  };

  const changeVariant = async (oldVariantId: string, newVariant: ChangeVariantParams) => {
    if (oldVariantId === newVariant.variantId) return;

    if (user) {
      setIsLoading(true);
      try {
        const res = await apiClient<Cart>(`/cart/items/${oldVariantId}/variant`, {
          method: 'PATCH',
          requireAuth: true,
          body: JSON.stringify({
            newVariantId: newVariant.variantId,
            sku: newVariant.sku,
            packageSize: newVariant.packageSize,
            price: newVariant.price,
          }),
        });
        if (res.success && res.data) {
          setItems(res.data.items || []);
        }
      } catch (err) {
        console.error('Error changing variant in auth cart:', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Guest local
      setItems((prev) => {
        const oldItem = prev.find((i) => i.variantId === oldVariantId);
        if (!oldItem) return prev;

        const existingNew = prev.find((i) => i.variantId === newVariant.variantId);
        if (existingNew) {
          // Merge quantities up to 99
          const mergedQty = Math.min(existingNew.quantity + oldItem.quantity, MAX_ITEM_QUANTITY);
          return prev
            .filter((i) => i.variantId !== oldVariantId)
            .map((i) => (i.variantId === newVariant.variantId ? { ...i, quantity: mergedQty } : i));
        } else {
          return prev.map((i) =>
            i.variantId === oldVariantId
              ? {
                  ...i,
                  variantId: newVariant.variantId,
                  sku: newVariant.sku,
                  packageSize: newVariant.packageSize,
                  price: newVariant.price,
                }
              : i,
          );
        }
      });
    }
  };

  const clearCart = async () => {
    if (user) {
      setIsLoading(true);
      try {
        await apiClient('/cart', {
          method: 'DELETE',
          requireAuth: true,
        });
        setItems([]);
      } catch (err) {
        console.error('Error clearing auth cart:', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setItems([]);
      try {
        localStorage.removeItem('phanbon_cart');
      } catch {
        // Ignore
      }
    }
  };

  const refreshCart = async () => {
    await loadCart();
  };

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        changeVariant,
        clearCart,
        refreshCart,
        totalItems,
        totalPrice,
        isOpen,
        setIsOpen,
        isLoading,
        error,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
