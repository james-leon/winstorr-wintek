import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
};

export type AppliedCoupon = {
  code: string;
  discountAmount: number;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
};

type CartCtx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  coupon: AppliedCoupon | null;
  setCoupon: (c: AppliedCoupon | null) => void;
  discount: number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "winstorr:cart:v1";
const COUPON_KEY = "winstorr:coupon:v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCouponState] = useState<AppliedCoupon | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
      const rawC = localStorage.getItem(COUPON_KEY);
      if (rawC) setCouponState(JSON.parse(rawC));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  useEffect(() => {
    try {
      if (coupon) localStorage.setItem(COUPON_KEY, JSON.stringify(coupon));
      else localStorage.removeItem(COUPON_KEY);
    } catch {}
  }, [coupon]);

  const setCoupon = (c: AppliedCoupon | null) => setCouponState(c);

  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const discount = coupon ? Math.min(coupon.discountAmount, subtotal) : 0;

  const value = useMemo<CartCtx>(
    () => ({
      items,
      add: (item, qty = 1) =>
        setItems((prev) => {
          const found = prev.find((p) => p.productId === item.productId);
          if (found) {
            return prev.map((p) =>
              p.productId === item.productId ? { ...p, quantity: p.quantity + qty } : p,
            );
          }
          return [...prev, { ...item, quantity: qty }];
        }),
      remove: (productId) => {
        setItems((prev) => prev.filter((p) => p.productId !== productId));
        // Coupon may no longer apply; user must re-apply
        setCouponState(null);
      },
      clear: () => { setItems([]); setCouponState(null); },
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal,
      coupon,
      setCoupon,
      discount,
    }),
    [items, coupon, subtotal, discount],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
