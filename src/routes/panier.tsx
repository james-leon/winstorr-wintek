import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, Trash2, ShoppingBag, Tag, X, Check } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFcfa } from "@/lib/format";
import { validateCouponFn } from "@/lib/coupons.functions";

export const Route = createFileRoute("/panier")({
  head: () => ({ meta: [{ title: "Panier — Winstorr" }, { name: "description", content: "Votre panier Winstorr." }] }),
  component: CartPage,
});

function CartPage() {
  const { items, add, remove, subtotal, coupon, setCoupon, discount } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const validateFn = useServerFn(validateCouponFn);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const apply = useMutation({
    mutationFn: async () => {
      const trimmed = code.trim();
      if (!trimmed) throw new Error("Entrez un code promo.");
      const res = await validateFn({
        data: {
          code: trimmed,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          customerEmail: user?.email ?? null,
        },
      });
      if (!res.ok) throw new Error(res.message);
      return res;
    },
    onSuccess: (r) => {
      if (r.ok) {
        setCoupon({
          code: r.code,
          discountAmount: r.discountAmount,
          discountType: r.discountType,
          discountValue: r.discountValue,
        });
        setError(null);
        setCode("");
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <ShoppingBag className="mx-auto h-14 w-14 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl text-foreground">Votre panier est vide</h1>
        <p className="mt-2 text-sm text-muted-foreground">Parcourez notre catalogue pour trouver ce dont vous avez besoin.</p>
        <Button asChild className="mt-6"><Link to="/catalogue">Voir le catalogue</Link></Button>
      </div>
    );
  }

  const inc = (i: typeof items[number]) =>
    add({ productId: i.productId, slug: i.slug, name: i.name, price: i.price, image: i.image }, 1);
  const dec = (i: typeof items[number]) => {
    if (i.quantity <= 1) return remove(i.productId);
    remove(i.productId);
    add({ productId: i.productId, slug: i.slug, name: i.name, price: i.price, image: i.image }, i.quantity - 1);
  };

  const total = subtotal - discount;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl text-foreground mb-4">Panier</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-sm border border-border bg-card divide-y divide-border">
          {items.map((i) => (
            <div key={i.productId} className="flex items-start gap-3 p-3">
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-sm bg-muted">
                {i.image ? <img src={i.image} alt={i.name} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <Link to="/produits/$slug" params={{ slug: i.slug }} className="block font-medium text-foreground line-clamp-2">
                  {i.name}
                </Link>
                <div className="mt-1 text-sm text-muted-foreground">{formatFcfa(i.price)} / unité</div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-sm border border-border">
                  <button className="p-1.5 hover:bg-muted" onClick={() => dec(i)} aria-label="Diminuer"><Minus className="h-4 w-4" /></button>
                  <span className="min-w-8 text-center text-sm font-medium">{i.quantity}</span>
                  <button className="p-1.5 hover:bg-muted" onClick={() => inc(i)} aria-label="Augmenter"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-accent">{formatFcfa(i.price * i.quantity)}</div>
                <button
                  onClick={() => remove(i.productId)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Retirer
                </button>
              </div>
            </div>
          ))}
        </div>

        <aside className="h-fit rounded-sm border border-border bg-card p-4 sticky top-4">
          <h2 className="font-semibold text-foreground mb-3">Récapitulatif</h2>

          <div className="mb-3 rounded-sm border border-border bg-background p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Tag className="h-3.5 w-3.5" /> CODE PROMO
            </div>
            {coupon ? (
              <div className="flex items-center justify-between gap-2 rounded-sm bg-success/10 px-2 py-1.5 text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-success">
                  <Check className="h-4 w-4" /> {coupon.code}
                </span>
                <button
                  onClick={() => setCoupon(null)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Retirer le code"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-1.5">
                  <Input
                    value={code}
                    onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
                    placeholder="Ex: BIENVENUE10"
                    className="h-8 text-sm uppercase"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => apply.mutate()}
                    disabled={apply.isPending}
                    className="h-8"
                  >
                    {apply.isPending ? "…" : "Appliquer"}
                  </Button>
                </div>
                {error && <p className="mt-1.5 text-xs text-muted-foreground">{error}</p>}
              </>
            )}
          </div>

          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Sous-total</span>
            <span className="font-medium">{formatFcfa(subtotal)}</span>
          </div>
          {coupon && discount > 0 && (
            <div className="flex justify-between text-sm py-1">
              <span className="text-success">Réduction ({coupon.code})</span>
              <span className="font-medium text-success">−{formatFcfa(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Livraison</span>
            <span className="text-muted-foreground">Calculée au paiement</span>
          </div>
          <div className="mt-3 border-t border-border pt-3 flex justify-between">
            <span className="font-semibold">Total estimé</span>
            <span className="text-lg font-bold text-accent">{formatFcfa(total)}</span>
          </div>
          <Button className="mt-4 w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => nav({ to: "/commande" })}>
            Passer commande
          </Button>
          <Link to="/catalogue" className="mt-3 block text-center text-sm text-secondary hover:underline">
            Continuer mes achats
          </Link>
        </aside>
      </div>
    </div>
  );
}
