import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { formatFcfa } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createOrder, initiatePayment } from "@/lib/orders.functions";

export const Route = createFileRoute("/commande")({
  head: () => ({ meta: [{ title: "Commande — Winstorr" }] }),
  component: CheckoutPage,
});

const CITIES = [
  { value: "douala", label: "Douala" },
  { value: "yaounde", label: "Yaoundé" },
  { value: "autre", label: "Autre" },
] as const;

const SHIPPING_TABLE: Record<string, number> = { douala: 2000, yaounde: 2500, autre: 3500 };

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const createFn = useServerFn(createOrder);
  const initFn = useServerFn(initiatePayment);

  const hasPhysical = useMemo(() => items.some((i) => !i.slug.includes("digital")), [items]);
  // We can't tell type from cart alone; conservatively assume physical unless all are digital.
  // Real flag comes from server. We show address by default if any item has weight — client heuristic OK.

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [ville, setVille] = useState<"douala" | "yaounde" | "autre">("douala");
  const [quartier, setQuartier] = useState("");
  const [landmark, setLandmark] = useState("");
  const [shipPhone, setShipPhone] = useState("");

  const shipping = hasPhysical ? SHIPPING_TABLE[ville] : 0;
  const total = subtotal + shipping;

  const mut = useMutation({
    mutationFn: async () => {
      const order = await createFn({
        data: {
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          contact: { name, phone, email: email || null },
          shipping_address: hasPhysical
            ? { full_name: name, phone: shipPhone || phone, ville, quartier, landmark: landmark || null }
            : null,
        },
      });
      const pay = await initFn({ data: { orderNumber: order.orderNumber } });
      return { orderNumber: order.orderNumber, paymentUrl: pay.paymentUrl, mocked: pay.mocked };
    },
    onSuccess: (r) => {
      clear();
      if (r.mocked) {
        toast.info("Mode test CinetPay actif — redirection vers la confirmation.");
        nav({ to: "/commande/$orderNumber/confirmation", params: { orderNumber: r.orderNumber } });
      } else {
        window.location.href = r.paymentUrl;
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-muted-foreground">Votre panier est vide.</p>
        <Button asChild className="mt-4"><Link to="/catalogue">Voir le catalogue</Link></Button>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { toast.error("Nom et téléphone requis."); return; }
    if (hasPhysical && (!quartier.trim())) { toast.error("Adresse de livraison requise."); return; }
    mut.mutate();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl text-foreground mb-4">Finaliser la commande</h1>
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="rounded-sm border border-border bg-card p-4">
            <h2 className="font-semibold mb-3">Vos coordonnées</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Nom complet *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label>Téléphone *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required />
              </div>
              <div className="sm:col-span-2">
                <Label>Email (optionnel)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            {!user && (
              <p className="mt-2 text-xs text-muted-foreground">
                Vous avez déjà un compte ? <Link to="/auth" className="text-secondary underline">Se connecter</Link>
              </p>
            )}
          </section>

          {hasPhysical && (
            <section className="rounded-sm border border-border bg-card p-4">
              <h2 className="font-semibold mb-3">Adresse de livraison</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Ville *</Label>
                  <select
                    className="mt-1 h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
                    value={ville}
                    onChange={(e) => setVille(e.target.value as typeof ville)}
                  >
                    {CITIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Quartier *</Label>
                  <Input value={quartier} onChange={(e) => setQuartier(e.target.value)} required={hasPhysical} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Point de repère / description</Label>
                  <Textarea value={landmark} onChange={(e) => setLandmark(e.target.value)} rows={2} placeholder="Ex : en face de la pharmacie du carrefour" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Téléphone pour la livraison</Label>
                  <Input value={shipPhone} onChange={(e) => setShipPhone(e.target.value)} placeholder="Laisser vide pour utiliser le contact ci-dessus" />
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-sm border border-border bg-card p-4 sticky top-4">
          <h2 className="font-semibold mb-3">Votre commande</h2>
          <ul className="space-y-2 mb-3 max-h-56 overflow-auto">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-2 text-sm">
                <span className="line-clamp-1">{i.name} × {i.quantity}</span>
                <span className="font-medium whitespace-nowrap">{formatFcfa(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Sous-total</span><span>{formatFcfa(subtotal)}</span></div>
            {hasPhysical && (
              <div className="flex justify-between"><span className="text-muted-foreground">Livraison ({ville})</span><span>{formatFcfa(shipping)}</span></div>
            )}
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold text-accent">{formatFcfa(total)}</span>
            </div>
          </div>
          <Button type="submit" disabled={mut.isPending} className="mt-4 w-full bg-accent hover:bg-accent/90 text-accent-foreground">
            {mut.isPending ? "Traitement..." : "Payer maintenant"}
          </Button>
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Paiement sécurisé — MTN MoMo, Orange Money, carte
          </p>
        </aside>
      </form>
    </div>
  );
}
