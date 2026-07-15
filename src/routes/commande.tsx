import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, MapPin, Home, Store, CreditCard, Wallet } from "lucide-react";
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
import { cn } from "@/lib/utils";

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

type PickupPoint = {
  id: string;
  name: string;
  address: string;
  city: string;
  contact_phone: string | null;
  opening_hours: string | null;
};

type DeliveryMode = "home_delivery" | "pickup";
type PaymentMethod = "cinetpay" | "cash_on_pickup";

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

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("home_delivery");
  const [pickupPointId, setPickupPointId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash_on_pickup");

  // Feature flags
  const { data: pmFlags } = useQuery({
    queryKey: ["settings", "payment_methods"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "payment_methods").maybeSingle();
      return (data?.value ?? { cinetpay: false, cash_on_pickup: true }) as { cinetpay: boolean; cash_on_pickup: boolean };
    },
  });
  const cinetpayEnabled = pmFlags?.cinetpay ?? false;
  const cashEnabled = pmFlags?.cash_on_pickup ?? true;

  useEffect(() => {
    if (paymentMethod === "cinetpay" && !cinetpayEnabled) setPaymentMethod("cash_on_pickup");
    if (paymentMethod === "cash_on_pickup" && !cashEnabled && cinetpayEnabled) setPaymentMethod("cinetpay");
  }, [cinetpayEnabled, cashEnabled, paymentMethod]);

  const { data: pickupPoints = [] } = useQuery({
    queryKey: ["pickup-points"],
    enabled: hasPhysical,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_points")
        .select("id, name, address, city, contact_phone, opening_hours")
        .eq("is_active", true)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as PickupPoint[];
    },
  });

  useEffect(() => {
    if (!pickupPointId && pickupPoints.length > 0) setPickupPointId(pickupPoints[0].id);
  }, [pickupPoints, pickupPointId]);

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

  const shipping = hasPhysical && deliveryMode === "home_delivery" ? SHIPPING_TABLE[ville] : 0;
  const total = Math.max(0, subtotal + shipping - discount);

  const mut = useMutation({
    mutationFn: async () => {
      const order = await createFn({
        data: {
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          contact: { name, phone, email: email || null },
          shipping_address:
            hasPhysical && deliveryMode === "home_delivery"
              ? { full_name: name, phone: shipPhone || phone, ville, quartier, landmark: landmark || null }
              : null,
          couponCode: coupon?.code ?? null,
          delivery_mode: hasPhysical ? deliveryMode : "none",
          pickup_point_id: deliveryMode === "pickup" ? pickupPointId : null,
          payment_method: paymentMethod,
        },
      });
      if (order.isCash) {
        return { orderNumber: order.orderNumber, paymentUrl: null as string | null, cash: true };
      }
      const pay = await initFn({ data: { orderNumber: order.orderNumber } });
      return { orderNumber: order.orderNumber, paymentUrl: pay.paymentUrl, mocked: pay.mocked, cash: false };
    },
    onSuccess: (r) => {
      clear();
      if (r.cash) {
        toast.success("Commande enregistrée. Paiement à la réception.");
        nav({ to: "/commande/$orderNumber/confirmation", params: { orderNumber: r.orderNumber } });
      } else if (r.paymentUrl) {
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
    if (hasPhysical && deliveryMode === "home_delivery" && !quartier.trim()) {
      toast.error("Adresse de livraison requise."); return;
    }
    if (hasPhysical && deliveryMode === "pickup" && !pickupPointId) {
      toast.error("Sélectionnez un point de retrait."); return;
    }
    mut.mutate();
  };

  const selectedPickup = pickupPoints.find((p) => p.id === pickupPointId);

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
              <h2 className="font-semibold mb-3">Mode de livraison</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDeliveryMode("home_delivery")}
                  className={cn(
                    "flex items-start gap-3 rounded-sm border p-3 text-left transition",
                    deliveryMode === "home_delivery" ? "border-secondary bg-secondary/5 ring-1 ring-secondary" : "border-border hover:bg-muted",
                  )}
                >
                  <Home className="mt-0.5 h-5 w-5 text-secondary" />
                  <div>
                    <div className="font-medium text-sm">Livraison à domicile</div>
                    <div className="text-xs text-muted-foreground">2 000 – 3 500 FCFA selon la ville</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMode("pickup")}
                  disabled={pickupPoints.length === 0}
                  className={cn(
                    "flex items-start gap-3 rounded-sm border p-3 text-left transition disabled:opacity-50",
                    deliveryMode === "pickup" ? "border-secondary bg-secondary/5 ring-1 ring-secondary" : "border-border hover:bg-muted",
                  )}
                >
                  <Store className="mt-0.5 h-5 w-5 text-secondary" />
                  <div>
                    <div className="font-medium text-sm">Retrait en point de retrait</div>
                    <div className="text-xs text-success font-medium">Gratuit</div>
                  </div>
                </button>
              </div>

              {deliveryMode === "pickup" && pickupPoints.length > 0 && (
                <div className="mt-4">
                  <Label>Point de retrait *</Label>
                  <div className="mt-1 space-y-2">
                    {pickupPoints.map((pp) => (
                      <label
                        key={pp.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-sm border p-3",
                          pickupPointId === pp.id ? "border-secondary bg-secondary/5" : "border-border hover:bg-muted",
                        )}
                      >
                        <input
                          type="radio"
                          name="pickup"
                          checked={pickupPointId === pp.id}
                          onChange={() => setPickupPointId(pp.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 text-sm">
                          <div className="font-medium">{pp.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" /> {pp.address}, {pp.city}
                          </div>
                          {pp.opening_hours && <div className="text-xs text-muted-foreground mt-0.5">{pp.opening_hours}</div>}
                          {pp.contact_phone && <div className="text-xs text-muted-foreground mt-0.5">Tel : {pp.contact_phone}</div>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {deliveryMode === "home_delivery" && (
                <div className="mt-4 space-y-3">
                  {user && savedAddresses.length > 0 && (
                    <div>
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
                      <Input value={quartier} onChange={(e) => setQuartier(e.target.value)} required={deliveryMode === "home_delivery"} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Point de repère</Label>
                      <Textarea value={landmark} onChange={(e) => setLandmark(e.target.value)} rows={2} placeholder="Ex : en face de la pharmacie du carrefour" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Téléphone pour la livraison</Label>
                      <Input value={shipPhone} onChange={(e) => setShipPhone(e.target.value)} placeholder="Laisser vide pour utiliser le contact ci-dessus" />
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="rounded-sm border border-border bg-card p-4">
            <h2 className="font-semibold mb-3">Mode de paiement</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {cashEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash_on_pickup")}
                  className={cn(
                    "flex items-start gap-3 rounded-sm border p-3 text-left transition",
                    paymentMethod === "cash_on_pickup" ? "border-secondary bg-secondary/5 ring-1 ring-secondary" : "border-border hover:bg-muted",
                  )}
                >
                  <Wallet className="mt-0.5 h-5 w-5 text-secondary" />
                  <div>
                    <div className="font-medium text-sm">Paiement à la réception (espèces)</div>
                    <div className="text-xs text-muted-foreground">
                      {deliveryMode === "pickup" ? "Payez au point de retrait" : "Payez au livreur à la livraison"}
                    </div>
                  </div>
                </button>
              )}
              {cinetpayEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cinetpay")}
                  className={cn(
                    "flex items-start gap-3 rounded-sm border p-3 text-left transition",
                    paymentMethod === "cinetpay" ? "border-secondary bg-secondary/5 ring-1 ring-secondary" : "border-border hover:bg-muted",
                  )}
                >
                  <CreditCard className="mt-0.5 h-5 w-5 text-secondary" />
                  <div>
                    <div className="font-medium text-sm">Paiement en ligne</div>
                    <div className="text-xs text-muted-foreground">MTN MoMo, Orange Money, carte</div>
                  </div>
                </button>
              )}
            </div>
            {!cashEnabled && !cinetpayEnabled && (
              <p className="mt-2 text-xs text-destructive">Aucun mode de paiement n'est actuellement activé.</p>
            )}
          </section>
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
            {hasPhysical && deliveryMode === "home_delivery" && (
              <div className="flex justify-between"><span className="text-muted-foreground">Livraison ({ville})</span><span>{formatFcfa(shipping)}</span></div>
            )}
            {hasPhysical && deliveryMode === "pickup" && (
              <div className="flex justify-between"><span className="text-muted-foreground">Retrait</span><span className="text-success">Gratuit</span></div>
            )}
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold text-accent">{formatFcfa(total)}</span>
            </div>
          </div>

          {deliveryMode === "pickup" && selectedPickup && (
            <div className="mt-3 rounded-sm border border-border bg-muted/50 p-2 text-xs">
              <div className="font-medium">{selectedPickup.name}</div>
              <div className="text-muted-foreground">{selectedPickup.address}, {selectedPickup.city}</div>
            </div>
          )}

          <Button type="submit" disabled={mut.isPending || (!cashEnabled && !cinetpayEnabled)} className="mt-4 w-full bg-accent hover:bg-accent/90 text-accent-foreground">
            {mut.isPending
              ? "Traitement..."
              : paymentMethod === "cash_on_pickup"
              ? "Confirmer la commande"
              : "Payer maintenant"}
          </Button>
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            {paymentMethod === "cash_on_pickup"
              ? "Vous paierez en espèces à la réception"
              : "Paiement sécurisé — MTN MoMo, Orange Money, carte"}
          </p>
        </aside>
      </form>
    </div>
  );
}
