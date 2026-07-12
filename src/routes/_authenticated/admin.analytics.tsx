import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatFcfa, PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/format";
import { StarRating } from "@/components/star-rating";
import { RefreshCw, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Admin Winstorr" }] }),
  component: AdminAnalytics,
});

type Preset = "today" | "7d" | "30d" | "this_month" | "last_month" | "custom";

function computeRange(preset: Preset, fromStr?: string, toStr?: string): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  switch (preset) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "7d": {
      const from = startOfDay(new Date(now.getTime() - 6 * 86400000));
      return { from, to: endOfDay(now) };
    }
    case "30d": {
      const from = startOfDay(new Date(now.getTime() - 29 * 86400000));
      return { from, to: endOfDay(now) };
    }
    case "this_month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "last_month":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 1),
      };
    case "custom": {
      const from = fromStr ? new Date(fromStr) : startOfDay(new Date(now.getTime() - 29 * 86400000));
      const to = toStr ? endOfDay(new Date(toStr)) : endOfDay(now);
      return { from, to };
    }
  }
}

type Analytics = {
  range: { from: string; to: string; bucket: "day" | "week" };
  summary: { revenue: number; paid_orders: number; total_orders: number; avg_order_value: number; paid_rate: number };
  series: { bucket: string; revenue: number; orders: number }[];
  top_products: {
    product_id: string; name: string; slug: string; type: ProductType;
    rating_average: number; rating_count: number; units: number; revenue: number;
  }[];
  by_type: { type: ProductType; revenue: number; units: number }[];
  by_category: { category: string; revenue: number; units: number }[];
  by_status: { status: string; count: number }[];
  low_stock: { id: string; name: string; slug: string; stock_quantity: number; vendor_id: string | null }[];
  coupons: { code: string; discount_type: string; discount_value: number; redemptions: number; total_discount: number; resulting_revenue: number }[];
  reviews: {
    avg_rating: number; total_reviews: number;
    recent: { id: string; rating: number; title: string | null; comment: string | null; created_at: string; product_name: string; product_slug: string }[];
  };
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "En attente paiement",
  paid: "Payée",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  completed: "Terminée",
  cancelled: "Annulée",
  payment_failed: "Paiement échoué",
};
const STATUS_TONE: Record<string, "success" | "warn" | "neutral" | "danger"> = {
  paid: "success", delivered: "success", completed: "success",
  processing: "neutral", shipped: "neutral", pending_payment: "warn",
  cancelled: "danger", payment_failed: "danger",
};

const TYPE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(210 40% 50%)"];

function AdminAnalytics() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");
  const [vendorId, setVendorId] = useState<string>("all");
  const [threshold, setThreshold] = useState(5);

  const range = useMemo(() => computeRange(preset, fromStr, toStr), [preset, fromStr, toStr]);

  const { data: vendors = [] } = useQuery({
    queryKey: ["analytics-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["admin-analytics", range.from.toISOString(), range.to.toISOString(), vendorId, threshold],
    queryFn: async (): Promise<Analytics> => {
      const { data, error } = await supabase.rpc("admin_analytics", {
        _from: range.from.toISOString(),
        _to: range.to.toISOString(),
        _vendor_id: vendorId === "all" ? null : vendorId,
        _low_stock_threshold: threshold,
      });
      if (error) throw error;
      return data as Analytics;
    },
  });

  const fmtBucket = (b: string) => {
    const d = new Date(b);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-sm border border-border bg-card p-4">
        <div>
          <Label className="text-xs">Période</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="7d">7 derniers jours</SelectItem>
              <SelectItem value="30d">30 derniers jours</SelectItem>
              <SelectItem value="this_month">Ce mois</SelectItem>
              <SelectItem value="last_month">Mois dernier</SelectItem>
              <SelectItem value="custom">Personnalisé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {preset === "custom" && (
          <>
            <div><Label className="text-xs">Du</Label><Input type="date" value={fromStr} onChange={(e) => setFromStr(e.target.value)} className="w-[160px]" /></div>
            <div><Label className="text-xs">Au</Label><Input type="date" value={toStr} onChange={(e) => setToStr(e.target.value)} className="w-[160px]" /></div>
          </>
        )}
        <div>
          <Label className="text-xs">Vendeur</Label>
          <Select value={vendorId} onValueChange={setVendorId}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les vendeurs</SelectItem>
              {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Seuil stock bas</Label>
          <Input type="number" min={0} value={threshold} onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))} className="w-[100px]" />
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Actualiser
          </Button>
        </div>
      </div>

      {error && <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{(error as Error).message}</div>}
      {isLoading && <div className="p-8 text-center text-muted-foreground">Chargement...</div>}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Chiffre d'affaires" value={formatFcfa(data.summary.revenue)} highlight />
            <StatCard label="Commandes payées" value={data.summary.paid_orders.toString()} sub={`sur ${data.summary.total_orders} créées`} />
            <StatCard label="Panier moyen" value={formatFcfa(Math.round(data.summary.avg_order_value))} />
            <StatCard
              label="Taux de conversion paiement"
              value={`${Math.round(data.summary.paid_rate * 100)}%`}
              tone={data.summary.paid_rate < 0.4 && data.summary.total_orders > 5 ? "danger" : "success"}
            />
          </div>

          {/* Revenue over time */}
          <Section title={`Ventes par ${data.range.bucket === "week" ? "semaine" : "jour"}`}>
            {data.series.length === 0 ? <Empty>Aucune donnée sur la période.</Empty> : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.series.map((s) => ({ ...s, label: fmtBucket(s.bucket) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v/1000)}k` : v)} />
                    <Tooltip formatter={(v: number, k) => k === "revenue" ? formatFcfa(v) : v} labelClassName="text-foreground" contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="revenue" name="Revenu" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="orders" name="Commandes" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} yAxisId={0} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* By type */}
            <Section title="Revenus par type de produit">
              {data.by_type.length === 0 ? <Empty>Aucune vente.</Empty> : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.by_type} dataKey="revenue" nameKey="type" cx="50%" cy="50%" outerRadius={90}
                           label={(e) => PRODUCT_TYPE_LABELS[e.type as ProductType] ?? e.type}>
                        {data.by_type.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatFcfa(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Section>

            {/* By category */}
            <Section title="Revenus par catégorie">
              {data.by_category.length === 0 ? <Empty>Aucune vente.</Empty> : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.by_category} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v/1000)}k` : v)} />
                      <YAxis type="category" dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={110} />
                      <Tooltip formatter={(v: number) => formatFcfa(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Section>
          </div>

          {/* Top products */}
          <Section title="Meilleures ventes">
            {data.top_products.length === 0 ? <Empty>Aucune vente.</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2">Produit</th><th className="p-2">Type</th>
                      <th className="p-2 text-right">Unités</th><th className="p-2 text-right">Revenu</th>
                      <th className="p-2">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.top_products.map((p) => (
                      <tr key={p.product_id}>
                        <td className="p-2">
                          <Link to="/produits/$slug" params={{ slug: p.slug }} className="font-medium hover:underline">{p.name}</Link>
                        </td>
                        <td className="p-2 text-xs">{PRODUCT_TYPE_LABELS[p.type] ?? p.type}</td>
                        <td className="p-2 text-right tabular-nums">{p.units}</td>
                        <td className="p-2 text-right font-semibold text-accent tabular-nums">{formatFcfa(p.revenue)}</td>
                        <td className="p-2">
                          {p.rating_count > 0
                            ? <div className="flex items-center gap-1"><StarRating value={Number(p.rating_average)} size="sm" /><span className="text-xs text-muted-foreground">({p.rating_count})</span></div>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Order status */}
            <Section title="État des commandes">
              {data.by_status.length === 0 ? <Empty>Aucune commande.</Empty> : (
                <ul className="space-y-2">
                  {data.by_status.map((s) => {
                    const tone = STATUS_TONE[s.status] ?? "neutral";
                    const cls = tone === "success" ? "bg-success/15 text-success"
                      : tone === "danger" ? "bg-destructive/15 text-destructive"
                      : tone === "warn" ? "bg-accent/15 text-accent"
                      : "bg-muted text-foreground";
                    return (
                      <li key={s.status} className="flex items-center justify-between rounded-sm border border-border p-2 text-sm">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${cls}`}>{STATUS_LABELS[s.status] ?? s.status}</span>
                        <span className="tabular-nums font-semibold">{s.count}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            {/* Low stock */}
            <Section title={`Stock bas (≤ ${threshold})`}>
              {data.low_stock.length === 0 ? <Empty>Tous les stocks sont OK.</Empty> : (
                <ul className="divide-y divide-border">
                  {data.low_stock.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                      <Link to="/produits/$slug" params={{ slug: p.slug }} className="hover:underline">{p.name}</Link>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${p.stock_quantity === 0 ? "bg-destructive/15 text-destructive" : "bg-accent/15 text-accent"}`}>
                        <AlertTriangle className="h-3 w-3" /> {p.stock_quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {/* Coupons */}
          <Section title="Performance des codes promo">
            {data.coupons.length === 0 ? <Empty>Aucun code utilisé sur la période.</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2">Code</th><th className="p-2">Réduction</th>
                      <th className="p-2 text-right">Utilisations</th>
                      <th className="p-2 text-right">Remise totale</th>
                      <th className="p-2 text-right">CA généré</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.coupons.map((c) => (
                      <tr key={c.code}>
                        <td className="p-2 font-mono font-semibold">{c.code}</td>
                        <td className="p-2 text-xs">{c.discount_type === "percentage" ? `${c.discount_value}%` : formatFcfa(c.discount_value)}</td>
                        <td className="p-2 text-right tabular-nums">{c.redemptions}</td>
                        <td className="p-2 text-right tabular-nums text-destructive">-{formatFcfa(c.total_discount)}</td>
                        <td className="p-2 text-right tabular-nums font-semibold">{formatFcfa(c.resulting_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Reviews */}
          <Section title="Avis clients">
            <div className="mb-3 flex items-center gap-4 text-sm">
              <div>Note moyenne : <span className="font-semibold">{Number(data.reviews.avg_rating).toFixed(2)}</span> / 5</div>
              <div className="text-muted-foreground">{data.reviews.total_reviews} avis au total</div>
            </div>
            {data.reviews.recent.length === 0 ? <Empty>Aucun avis récent.</Empty> : (
              <ul className="divide-y divide-border">
                {data.reviews.recent.map((r) => (
                  <li key={r.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link to="/produits/$slug" params={{ slug: r.product_slug }} className="font-medium hover:underline">{r.product_name}</Link>
                      <div className="flex items-center gap-2">
                        <StarRating value={r.rating} size="sm" />
                        <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
                      </div>
                    </div>
                    {r.title && <div className="text-xs font-medium">{r.title}</div>}
                    {r.comment && <div className="text-xs text-muted-foreground line-clamp-2">{r.comment}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, highlight, tone }: { label: string; value: string; sub?: string; highlight?: boolean; tone?: "success" | "danger" }) {
  const valueCls = highlight ? "text-accent" : tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl ${valueCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-center text-sm text-muted-foreground">{children}</div>;
}
