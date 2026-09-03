import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useCartTiers, resolveUnitPrice, tierKey, type PriceTier } from "@/lib/tiers";
import { useLanguage } from "@/lib/i18n/language-context";

export type CartItem = {
  productId: string;
  variantId: string | null;
  variantAttributes: Record<string, string> | null;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  /** Legacy carts have no type — treat those as physical. */
  productType?: "physical" | "digital";
};

export type AppliedCoupon = {
  code: string;
  discountAmount: number;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
};

/** Stable line key for a cart item — product+variant, so two variants of the same product are distinct lines. */
export const cartItemKey = (i: Pick<CartItem, "productId" | "variantId">) =>
  `${i.productId}::${i.variantId ?? ""}`;

type CartCtx = {
  items: CartItem[];
  /** Returns false when the item was refused (digital/physical cannot be mixed). */
  add: (item: Omit<CartItem, "quantity">, qty?: number) => boolean;
  remove: (key: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  coupon: AppliedCoupon | null;
  setCoupon: (c: AppliedCoupon | null) => void;
  discount: number;
  tiersMap: Record<string, PriceTier[]>;
  /** False until the cart has been read from localStorage (SSR/first paint). */
  hydrated: boolean;
  effectiveUnit: (item: Pick<CartItem, "productId" | "variantId" | "price">, quantity: number) => number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "winstorr:cart:v2";
const COUPON_KEY = "winstorr:coupon:v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCouponState] = useState<AppliedCoupon | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CartItem>[];
        // Normalize legacy entries (no variantId field).
        setItems(
          parsed.map((i) => ({
            ...(i as CartItem),
            variantId: i.variantId ?? null,
            variantAttributes: i.variantAttributes ?? null,
          })),
        );
      }
      const rawC = localStorage.getItem(COUPON_KEY);
      if (rawC) setCouponState(JSON.parse(rawC));
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  useEffect(() => {
    try {
      if (coupon) localStorage.setItem(COUPON_KEY, JSON.stringify(coupon));
      else localStorage.removeItem(COUPON_KEY);
    } catch { /* ignore */ }
  }, [coupon]);

  const setCoupon = (c: AppliedCoupon | null) => setCouponState(c);

  const { data: tiersMap } = useCartTiers(
    items.map((i) => ({ productId: i.productId, variantId: i.variantId })),
  );
  const tiers = tiersMap ?? {};

  const effectiveUnit: CartCtx["effectiveUnit"] = (item, quantity) => {
    const list = tiers[tierKey(item.productId, item.variantId)];
    return resolveUnitPrice(list, quantity, item.price) ?? item.price;
  };

  const subtotal = items.reduce(
    (n, i) => n + effectiveUnit(i, i.quantity) * i.quantity,
    0,
  );
  const discount = coupon ? Math.min(coupon.discountAmount, subtotal) : 0;

  const value = useMemo<CartCtx>(
    () => ({
      items,
      add: (item, qty = 1) =>
        setItems((prev) => {
          const k = cartItemKey(item);
          const found = prev.find((p) => cartItemKey(p) === k);
          if (found) {
            return prev.map((p) =>
              cartItemKey(p) === k ? { ...p, quantity: p.quantity + qty } : p,
            );
          }
          return [...prev, { ...item, quantity: qty }];
        }),
      remove: (k) => {
        setItems((prev) => prev.filter((p) => cartItemKey(p) !== k));
        setCouponState(null);
      },
      clear: () => { setItems([]); setCouponState(null); },
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal,
      coupon,
      setCoupon,
      discount,
      tiersMap: tiers,
      hydrated,
      effectiveUnit,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, coupon, subtotal, discount, tiers, hydrated],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
