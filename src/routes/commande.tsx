import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, MapPin, Truck, Store, CreditCard, Wallet, Clock, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDeliveryZones, useHomeDeliverySettings, resolveDeliveryFee } from "@/lib/delivery";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { formatFcfa } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createOrder } from "@/lib/orders.functions";
import { startCampayPayment } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import { type CityValue } from "@/lib/address";
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
type PaymentMethod = "campay_momo" | "campay_card" | "cash_on_pickup";

function CheckoutPage() {
  const { items, subtotal, coupon, discount, clear, effectiveUnit } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const createFn = useServerFn(createOrder);
  const startPayFn = useServerFn(startCampayPayment);

  const hasPhysical = useMemo(() => items.some((i) => (i.productType ?? "physical") === "physical"), [items]);
  const hasDigital = useMemo(() => items.some((i) => i.productType === "digital"), [items]);
  const [momoPhone, setMomoPhone] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [ville, setVille] = useState<CityValue>("douala");
  const [quartier, setQuartier] = useState("");
  const [landmark, setLandmark] = useState("");
  const [shipPhone, setShipPhone] = useState("");
  const [selectedAddrId, setSelectedAddrId] = useState<string>("new");

  const [instructions, setInstructions] = useState("");

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("home_delivery");
  const [pickupPointId, setPickupPointId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash_on_pickup");

  const { t } = useTranslation();
  const { data: homeDelivery } = useHomeDeliverySettings();
  const { data: zones = [] } = useDeliveryZones();
  const homeDeliveryEnabled = (homeDelivery?.enabled ?? false) && zones.length > 0;
  // Zones are an internal admin grouping — the client only sees a flat list of quartiers.
  const quartierOptions = useMemo(
    () =>
      zones
        .flatMap((z) => z.quartiers.map((q) => ({ quartier: q, zone: z })))
        .sort((a, b) => a.quartier.localeCompare(b.quartier, "fr")),
    [zones],
  );
  const zone = quartierOptions.find((o) => o.quartier === quartier)?.zone ?? null;
  const minZoneFee = zones.length ? Math.min(...zones.map((z) => z.fee)) : 0;

  // Fall back to pickup when the courier service is off.
  useEffect(() => {
    if (!homeDeliveryEnabled && deliveryMode === "home_delivery" && homeDelivery) {
      setDeliveryMode("pickup");
    }
  }, [homeDeliveryEnabled, deliveryMode, homeDelivery]);

  // Feature flags
  const { data: pmFlags } = useQuery({
    queryKey: ["settings", "payment_methods"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "payment_methods").maybeSingle();
      return (data?.value ?? { campay: true, cash_on_pickup: true }) as { campay?: boolean; cash_on_pickup?: boolean };
    },
  });
  const campayEnabled = pmFlags?.campay ?? true;
  // Digital goods can never be paid on delivery.
  const cashEnabled = (pmFlags?.cash_on_pickup ?? true) && !hasDigital;

  useEffect(() => {
    if (paymentMethod.startsWith("campay") && !campayEnabled) setPaymentMethod("cash_on_pickup");
    if (paymentMethod === "cash_on_pickup" && !cashEnabled && campayEnabled) setPaymentMethod("campay_momo");
  }, [campayEnabled, cashEnabled, paymentMethod]);

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

  const shipping =
    hasPhysical && deliveryMode === "home_delivery" ? resolveDeliveryFee(zone, subtotal, homeDelivery) : 0;
  const total = Math.max(0, subtotal + shipping - discount);

  const mut = useMutation({
    mutationFn: async () => {
      const order = await createFn({
        data: {
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
          contact: { name, phone, email: email || null },
          shipping_address:
            hasPhysical && deliveryMode === "home_delivery"
              ? {
                  full_name: name,
                  phone: shipPhone || phone,
                  ville,
                  quartier,
                  landmark: landmark || null,
                  instructions: instructions || null,
                  zone_name: zone?.name ?? null,
                }
              : null,
          couponCode: coupon?.code ?? null,
          delivery_mode: hasPhysical ? deliveryMode : "none",
          pickup_point_id: deliveryMode === "pickup" ? pickupPointId : null,
          delivery_zone_id: deliveryMode === "home_delivery" ? zone?.id ?? null : null,
          payment_method: paymentMethod === "cash_on_pickup" ? "cash_on_pickup" : "campay",
        },
      });
      if (order.isCash) {
        return { orderNumber: order.orderNumber, redirectUrl: null as string | null, cash: true };
      }
      // The browser only *starts* the payment. Confirmation is server-side only.
      const pay = await startPayFn({
        data: {
          orderNumber: order.orderNumber,
          mode: paymentMethod === "campay_card" ? "card" : "momo",
          phone: paymentMethod === "campay_momo" ? momoPhone || phone : null,
        },
      });
      return { orderNumber: order.orderNumber, redirectUrl: pay.link, cash: false };
    },
    onSuccess: (r) => {
      clear();
      if (r.cash) {
        toast.success("Commande enregistrée. Paiement à la réception.");
      } else if (r.redirectUrl) {
        window.location.href = r.redirectUrl;
        return;
      } else {
        toast.success(t("checkout.momoPrompt"));
      }
      nav({ to: "/commande/$orderNumber/confirmation", params: { orderNumber: r.orderNumber } });
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
    if (hasPhysical && deliveryMode === "home_delivery" && (!quartier.trim() || !zone)) {
      toast.error(t("delivery.addressRequired")); return;
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
                  disabled={!homeDeliveryEnabled}
                  className={cn(
                    "flex items-start gap-3 rounded-sm border p-3 text-left transition disabled:opacity-50",
                    deliveryMode === "home_delivery" ? "border-secondary bg-secondary/5 ring-1 ring-secondary" : "border-border hover:bg-muted",
                  )}
                >
                  <Truck className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{t("delivery.homeDelivery")}</div>
                    <div className="text-xs text-muted-foreground">
                      {homeDelivery?.courier_name ?? "Intello Express"} · {t("delivery.feeFrom", { fee: formatFcfa(minZoneFee) })}
                    </div>
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
                    <div className="min-w-0">
                      <Label>{t("delivery.city")}</Label>
                      <Input value={zones[0]?.city ?? "Douala"} readOnly className="mt-1 bg-muted" />
                    </div>
                    <div className="min-w-0">
                      <Label>{t("delivery.quartier")} *</Label>
                      <select
                        className="mt-1 h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
                        value={quartier}
                        onChange={(e) => setQuartier(e.target.value)}
                      >
                        <option value="" disabled>{t("delivery.quartierPlaceholder")}</option>
                        {quartierOptions.map((o) => (
                          <option key={o.quartier} value={o.quartier}>
                            {o.quartier} — {formatFcfa(o.zone.fee)}
                          </option>
                        ))}
                      </select>
                      {zone && (
                        <p className="mt-1.5 text-xs font-medium text-secondary">
                          {t("delivery.feeAtQuartier", { quartier, fee: formatFcfa(resolveDeliveryFee(zone, subtotal, homeDelivery)) })}
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <Label>{t("delivery.phone")}</Label>
                      <Input value={shipPhone} onChange={(e) => setShipPhone(e.target.value)} placeholder={t("delivery.phoneHint")} />
                    </div>
                    <div className="sm:col-span-2 min-w-0">
                      <Label>{t("delivery.landmark")}</Label>
                      <Textarea value={landmark} onChange={(e) => setLandmark(e.target.value)} rows={2} placeholder={t("delivery.landmarkPlaceholder")} />
                    </div>
                    <div className="sm:col-span-2 min-w-0">
                      <Label>{t("delivery.instructions")}</Label>
                      <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder={t("delivery.instructionsPlaceholder")} />
                    </div>
                  </div>

                  <div className="rounded-sm border border-border bg-muted/50 p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Clock className="h-3.5 w-3.5 text-secondary" />
                      {t("delivery.eta", { delay: homeDelivery?.delay_text ?? "sous 24-48h" })}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{t("delivery.feeLabel")}</span>
                      <span className="font-semibold">
                        {!zone ? "—" : shipping === 0 ? t("delivery.free") : formatFcfa(shipping)}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{t("delivery.codNotice")}</p>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="rounded-sm border border-border bg-card p-4">
            <h2 className="font-semibold mb-3">{t("checkout.paymentTitle")}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {campayEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod("campay_momo")}
                  className={cn(
                    "flex items-start gap-3 rounded-sm border p-3 text-left transition",
                    paymentMethod === "campay_momo" ? "border-secondary bg-secondary/5 ring-1 ring-secondary" : "border-border hover:bg-muted",
                  )}
                >
                  <Smartphone className="mt-0.5 h-5 w-5 text-secondary" />
                  <div>
                    <div className="font-medium text-sm">{t("checkout.payMomo")}</div>
                    <div className="text-xs text-muted-foreground">{t("checkout.payMomoSub")}</div>
                  </div>
                </button>
              )}
              {campayEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod("campay_card")}
                  className={cn(
                    "flex items-start gap-3 rounded-sm border p-3 text-left transition",
                    paymentMethod === "campay_card" ? "border-secondary bg-secondary/5 ring-1 ring-secondary" : "border-border hover:bg-muted",
                  )}
                >
                  <CreditCard className="mt-0.5 h-5 w-5 text-secondary" />
                  <div>
                    <div className="font-medium text-sm">{t("checkout.payCard")}</div>
                    <div className="text-xs text-muted-foreground">{t("checkout.payCardSub")}</div>
                  </div>
                </button>
              )}
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
                    <div className="font-medium text-sm">{t("checkout.payOnDelivery")}</div>
                    <div className="text-xs text-muted-foreground">
                      {deliveryMode === "pickup" ? t("checkout.payAtPickup") : t("checkout.payToCourier")}
                    </div>
                  </div>
                </button>
              )}
            </div>

            {paymentMethod === "campay_momo" && campayEnabled && (
              <div className="mt-3 max-w-sm">
                <Label>{t("checkout.momoPhone")}</Label>
                <Input
                  value={momoPhone}
                  onChange={(e) => setMomoPhone(e.target.value)}
                  placeholder={phone || "6XX XX XX XX"}
                  inputMode="tel"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("checkout.momoPhoneHint")}</p>
              </div>
            )}

            {hasDigital && (
              <p className="mt-3 text-xs text-muted-foreground">{t("checkout.digitalNotice")}</p>
            )}

            {!cashEnabled && !campayEnabled && (
              <p className="mt-2 text-xs text-destructive">{t("checkout.noPaymentMethod")}</p>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-sm border border-border bg-card p-4 sticky top-4">
          <h2 className="font-semibold mb-3">Votre commande</h2>
          <ul className="space-y-2 mb-3 max-h-56 overflow-auto">
            {items.map((i) => {
              const key = `${i.productId}::${i.variantId ?? ""}`;
              const attrs = i.variantAttributes ? Object.entries(i.variantAttributes).map(([k, v]) => `${k}: ${v}`).join(" · ") : "";
              return (
                <li key={key} className="flex justify-between gap-2 text-sm">
                  <span className="line-clamp-1">
                    {i.name} × {i.quantity}
                    {attrs && <span className="ml-1 text-muted-foreground">({attrs})</span>}
                  </span>
                  <span className="font-medium whitespace-nowrap">{formatFcfa(effectiveUnit(i, i.quantity) * i.quantity)}</span>
                </li>
              );
            })}
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
              <div className="flex justify-between"><span className="text-muted-foreground">{t("delivery.feeLabel")}{quartier ? ` (${quartier})` : ""}</span><span>{shipping === 0 && zone ? t("delivery.free") : formatFcfa(shipping)}</span></div>
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
