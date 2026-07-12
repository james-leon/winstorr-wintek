import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { CITIES, SHIPPING_TABLE, type CityValue } from "@/lib/address";

export const Route = createFileRoute("/commande")({
  head: () => ({ meta: [{ title: "Commande — Winstorr" }] }),
  component: CheckoutPage,
});

type SavedAddress = {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  city: CityValue;
  quartier: string;
  landmark_description: string | null;
  is_default: boolean;
};

function CheckoutPage() {
  const { items, subtotal, coupon, discount, clear } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const createFn = useServerFn(createOrder);
  const initFn = useServerFn(initiatePayment);

  const hasPhysical = useMemo(() => items.some((i) => !i.slug.includes("digital")), [items]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [ville, setVille] = useState<CityValue>("douala");
  const [quartier, setQuartier] = useState("");
  const [landmark, setLandmark] = useState("");
  const [shipPhone, setShipPhone] = useState("");
  const [selectedAddrId, setSelectedAddrId] = useState<string>("new");

  const { data: savedAddresses = [] } = useQuery({
    queryKey: ["addresses-for-checkout", user?.id],
    enabled: !!user && hasPhysical,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("id, label, full_name, phone, city, quartier, landmark_description, is_default")
        .eq("customer_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedAddress[];
    },
  });

  // Auto-select default address once loaded
  useEffect(() => {
    if (!hasPhysical || savedAddresses.length === 0 || selectedAddrId !== "new") return;
    const def = savedAddresses.find((a) => a.is_default) ?? savedAddresses[0];
    if (def) applyAddress(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAddresses, hasPhysical]);

  function applyAddress(a: SavedAddress) {
    setSelectedAddrId(a.id);
    setName(a.full_name);
    setShipPhone(a.phone);
    setVille(a.city);
    setQuartier(a.quartier);
    setLandmark(a.landmark_description ?? "");
    if (!phone) setPhone(a.phone);
  }

  function chooseAddress(id: string) {
    if (id === "new") {
      setSelectedAddrId("new");
      setQuartier(""); setLandmark(""); setShipPhone("");
      return;
    }
    const a = savedAddresses.find((x) => x.id === id);
    if (a) applyAddress(a);
  }

  const shipping = hasPhysical ? SHIPPING_TABLE[ville] : 0;
  const total = Math.max(0, subtotal + shipping - discount);


  const mut = useMutation({
    mutationFn: async () => {
      const order = await createFn({
        data: {
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          contact: { name, phone, email: email || null },
          shipping_address: hasPhysical
            ? { full_name: name, phone: shipPhone || phone, ville, quartier, landmark: landmark || null }
            : null,
          couponCode: coupon?.code ?? null,
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
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Adresse de livraison</h2>
                {user && (
                  <Link to="/mon-compte/adresses" className="text-xs text-secondary underline">
                    Gérer mes adresses
                  </Link>
                )}
              </div>

              {user && savedAddresses.length > 0 && (
                <div className="mb-3">
                  <Label>Utiliser une adresse enregistrée</Label>
                  <select
                    className="mt-1 h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
                    value={selectedAddrId}
                    onChange={(e) => chooseAddress(e.target.value)}
                  >
                    {savedAddresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} — {a.quartier}{a.is_default ? " (par défaut)" : ""}
                      </option>
                    ))}
                    <option value="new">➕ Nouvelle adresse</option>
                  </select>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Ville *</Label>
                  <select
                    className="mt-1 h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
                    value={ville}
                    onChange={(e) => setVille(e.target.value as CityValue)}
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
            {coupon && discount > 0 && (
              <div className="flex justify-between">
                <span className="text-success">Réduction ({coupon.code})</span>
                <span className="font-medium text-success">−{formatFcfa(discount)}</span>
              </div>
            )}
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
