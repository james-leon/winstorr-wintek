import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, MapPin, Calendar, Clock, Package, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TypeBadge } from "@/components/type-badge";
import { displayPrice, formatFcfa, type ProductType } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Product = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  images: string[];
  type: ProductType;
  price: number | null;
  price_type: "fixed" | "starting_at" | "quote_only";
  compare_at_price: number | null;
  stock_quantity: number | null;
  delivery_type: "file_download" | "license_key" | "access_link" | null;
  delivery_instructions: string | null;
  service_area: "on_site" | "in_shop" | "remote" | "both" | null;
  estimated_duration: string | null;
  delivery_mode: "in_person" | "online" | "hybrid" | null;
};

const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async (): Promise<Product> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, short_description, description, images, type, price, price_type, compare_at_price, stock_quantity, delivery_type, delivery_instructions, service_area, estimated_duration, delivery_mode")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return { ...data, images: Array.isArray(data.images) ? (data.images as string[]) : [] } as Product;
    },
  });

export const Route = createFileRoute("/produits/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productQuery(params.slug)),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — Winstorr` },
          { name: "description", content: loaderData.short_description ?? loaderData.name },
          { property: "og:title", content: loaderData.name },
          { property: "og:description", content: loaderData.short_description ?? "" },
          ...(loaderData.images[0] ? [{ property: "og:image" as const, content: loaderData.images[0] }] : []),
        ]
      : [{ title: "Produit — Winstorr" }, { name: "robots", content: "noindex" }],
  }),
  component: ProductDetail,
  errorComponent: ({ error }) => <div className="p-8 text-center text-destructive">{error.message}</div>,
  notFoundComponent: () => (
    <div className="p-16 text-center">
      <h1 className="font-display text-3xl">Produit introuvable</h1>
      <p className="mt-2 text-muted-foreground">Ce produit n'existe pas ou n'est plus disponible.</p>
      <Button asChild className="mt-6"><Link to="/catalogue">Retour au catalogue</Link></Button>
    </div>
  ),
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const { data: p } = useSuspenseQuery(productQuery(slug));
  const [activeImg, setActiveImg] = useState(0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/catalogue" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Retour au catalogue
      </Link>
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            {p.images[activeImg] ? (
              <img src={p.images[activeImg]} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-muted-foreground">Pas d'image</div>
            )}
          </div>
          {p.images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {p.images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`aspect-square overflow-hidden rounded-md border-2 ${i === activeImg ? "border-primary" : "border-transparent"}`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <TypeBadge type={p.type} />
          <h1 className="mt-3 font-display text-3xl text-foreground md:text-4xl">{p.name}</h1>
          {p.short_description && <p className="mt-3 text-muted-foreground">{p.short_description}</p>}

          <div className="mt-6 flex items-baseline gap-3">
            <div className="font-display text-3xl text-primary">{displayPrice(p)}</div>
            {p.compare_at_price && p.price && p.compare_at_price > p.price && (
              <div className="text-lg text-muted-foreground line-through">{formatFcfa(p.compare_at_price)}</div>
            )}
          </div>

          <div className="mt-6">
            {p.type === "physical" && <PhysicalActions p={p} />}
            {p.type === "digital" && <DigitalActions p={p} />}
            {p.type === "service" && <ServiceActions p={p} />}
            {p.type === "training" && <TrainingActions p={p} />}
          </div>

          {p.description && (
            <div className="mt-10 border-t border-border pt-6">
              <h2 className="font-display text-xl text-foreground">Description</h2>
              <div className="prose mt-3 max-w-none whitespace-pre-wrap text-sm text-foreground/80">{p.description}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----- physical ----- */
function PhysicalActions({ p }: { p: Product }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const stock = p.stock_quantity ?? 0;
  const stockLabel =
    stock <= 0 ? { text: "Rupture de stock", cls: "text-destructive" }
    : stock <= 3 ? { text: `Stock limité (${stock})`, cls: "text-accent" }
    : { text: "En stock", cls: "text-success" };

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 text-sm font-medium ${stockLabel.cls}`}>
        <Package className="h-4 w-4" /> {stockLabel.text}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-md border border-input">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2 text-lg">−</button>
          <span className="min-w-8 text-center">{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} className="px-3 py-2 text-lg">+</button>
        </div>
        <Button
          size="lg"
          className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          disabled={stock <= 0 || !p.price}
          onClick={() => {
            if (!p.price) return;
            add({ productId: p.id, slug: p.slug, name: p.name, price: p.price, image: p.images[0] ?? null }, qty);
            toast.success(`${p.name} ajouté au panier`);
          }}
        >
          Ajouter au panier
        </Button>
      </div>
    </div>
  );
}

/* ----- digital ----- */
function DigitalActions({ p }: { p: Product }) {
  const labels: Record<NonNullable<Product["delivery_type"]>, string> = {
    file_download: "Livraison immédiate par téléchargement",
    license_key: "Clé de licence envoyée par email",
    access_link: "Lien d'accès envoyé par email",
  };
  return (
    <div className="space-y-4">
      {p.delivery_type && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3">
          <Download className="mt-0.5 h-4 w-4 text-primary" />
          <div className="text-sm">
            <div className="font-medium text-foreground">{labels[p.delivery_type]}</div>
            {p.delivery_instructions && <div className="mt-1 text-muted-foreground">{p.delivery_instructions}</div>}
          </div>
        </div>
      )}
      <Button
        size="lg"
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        onClick={() => toast.info("Le paiement en ligne sera disponible prochainement.")}
      >
        Acheter maintenant
      </Button>
    </div>
  );
}

/* ----- service ----- */
function ServiceActions({ p }: { p: Product }) {
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", customer_email: "", description: "", preferred_date: "" });
  const [done, setDone] = useState(false);
  const areas: Record<NonNullable<Product["service_area"]>, string> = {
    on_site: "À domicile", in_shop: "En atelier", remote: "À distance", both: "À domicile ou en atelier",
  };
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("service_requests").insert({
        product_id: p.id,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        customer_email: form.customer_email.trim() || null,
        description: form.description.trim(),
        preferred_date: form.preferred_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => setDone(true),
    onError: (e: Error) => toast.error(e.message),
  });

  if (done) {
    return (
      <div className="rounded-lg border border-success/40 bg-success/10 p-5">
        <h3 className="font-display text-lg text-success">Demande envoyée ✓</h3>
        <p className="mt-2 text-sm text-foreground/80">
          Nous vous recontactons sous 24h au numéro fourni pour confirmer votre demande.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
      className="space-y-3 rounded-lg border border-border bg-card p-5"
    >
      <h3 className="font-display text-lg text-foreground">Demander un devis</h3>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {p.service_area && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {areas[p.service_area]}</span>}
        {p.estimated_duration && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {p.estimated_duration}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Nom complet *</Label><Input required minLength={2} value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
        <div><Label>Téléphone *</Label><Input required minLength={6} value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
      </div>
      <div><Label>Email</Label><Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} /></div>
      <div><Label>Description du besoin *</Label><Textarea required minLength={5} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div><Label>Date souhaitée</Label><Input type="date" value={form.preferred_date} onChange={(e) => setForm({ ...form, preferred_date: e.target.value })} /></div>
      <Button type="submit" size="lg" disabled={mut.isPending} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
        {mut.isPending ? "Envoi..." : "Envoyer la demande"}
      </Button>
    </form>
  );
}

/* ----- training ----- */
type Session = { id: string; start_date: string; end_date: string; location: string | null; capacity: number; seats_taken: number; price_override: number | null; status: string };

function TrainingActions({ p }: { p: Product }) {
  const { data: sessions = [], refetch } = useQuery({
    queryKey: ["sessions", p.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, start_date, end_date, location, capacity, seats_taken, price_override, status")
        .eq("product_id", p.id)
        .in("status", ["scheduled", "full"])
        .gte("start_date", new Date().toISOString())
        .order("start_date");
      if (error) throw error;
      return data as Session[];
    },
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const active = sessions.find((s) => s.id === openId) ?? null;

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-foreground">Prochaines sessions</h3>
      {sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          Aucune session programmée. Revenez bientôt !
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const seats = s.capacity - s.seats_taken;
            const full = s.status === "full" || seats <= 0;
            const price = s.price_override ?? p.price;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <Calendar className="h-4 w-4 text-primary" />
                    {new Date(s.start_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {s.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.location}</span>}
                    <span>{full ? "Complet" : `${seats} place${seats > 1 ? "s" : ""} restante${seats > 1 ? "s" : ""}`}</span>
                    {price != null && <span className="font-medium text-foreground">{formatFcfa(price)}</span>}
                  </div>
                </div>
                <Button disabled={full} onClick={() => setOpenId(s.id)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  {full ? "Complet" : "S'inscrire"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <EnrollDialog session={active} onClose={() => setOpenId(null)} onDone={() => { setOpenId(null); refetch(); }} />
    </div>
  );
}

function EnrollDialog({ session, onClose, onDone }: { session: Session | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const mut = useMutation({
    mutationFn: async () => {
      if (!session) return;
      const { error } = await supabase.from("training_enrollments").insert({
        session_id: session.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscription enregistrée. Nous vous confirmerons par téléphone.");
      setForm({ name: "", phone: "", email: "" });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!session} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Inscription à la session</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
          <div><Label>Nom complet *</Label><Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Téléphone *</Label><Input required minLength={6} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "..." : "Confirmer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
