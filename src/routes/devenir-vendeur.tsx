import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ShieldCheck, CreditCard, Truck, Store, CheckCircle2, ArrowRight, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/devenir-vendeur")({
  head: () => ({
    meta: [
      { title: "Devenir vendeur sur Winstorr — Vendez en ligne au Cameroun" },
      { name: "description", content: "Rejoignez la marketplace Winstorr : paiement après livraison confirmée, MTN MoMo et Orange Money gérés, livreurs partenaires. Sans site web à créer." },
      { property: "og:title", content: "Devenir vendeur sur Winstorr" },
      { property: "og:description", content: "Vendez à des milliers de clients au Cameroun sans construire votre propre site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DevenirVendeurPage,
});

const PRODUCT_TYPE_OPTIONS = [
  "Téléphones & accessoires",
  "Ordinateurs & informatique",
  "Audio & TV",
  "Électroménager",
  "Mode & beauté",
  "Sécurité & vidéosurveillance",
  "Bricolage & outillage",
  "Formations & services",
  "Autre",
];

function DevenirVendeurPage() {
  const { data: commission } = useQuery({
    queryKey: ["public-global-commission"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_rules")
        .select("commission_type, commission_value")
        .eq("scope", "global")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    staleTime: 10 * 60_000,
  });
  const commissionLabel = commission
    ? commission.commission_type === "percentage"
      ? `${Number(commission.commission_value)}%`
      : `${commission.commission_value} FCFA / vente`
    : "10%";

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border" style={{ background: "var(--color-header)" }}>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 md:py-16">
          <div className="text-white">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Marketplace vérifiée par Wintek
            </div>
            <h1 className="mt-4 font-display text-3xl leading-tight md:text-5xl">
              Vendez sur Winstorr.<br />
              <span style={{ color: "#FF7A18" }}>Concentrez-vous sur vos produits.</span>
            </h1>
            <p className="mt-4 max-w-lg text-base text-white/85">
              Atteignez des milliers de clients au Cameroun sans construire votre propre site.
              Nous gérons les paiements, la logistique et la confiance. Vous gérez votre boutique.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#candidature" className="inline-flex items-center gap-1.5 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-white/90 no-link-color">
                Postuler maintenant <ArrowRight className="h-4 w-4" />
              </a>
              <Link to="/boutiques" className="inline-flex items-center gap-1.5 rounded-md border border-white/30 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 no-link-color">
                Voir les boutiques existantes
              </Link>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: ShieldCheck, title: "Escrow protégé", body: "Payé après livraison confirmée" },
                { icon: CreditCard, title: "Paiement géré", body: "MoMo, Orange Money, carte" },
                { icon: Truck, title: "Livreurs partenaires", body: "Colis récupérés chez vous" },
                { icon: Store, title: "Votre boutique", body: "Sans site web à construire" },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-lg border border-white/15 bg-white/5 p-4 text-white">
                  <Icon className="h-6 w-6 text-[color:var(--accent)]" />
                  <div className="mt-2 text-sm font-semibold">{title}</div>
                  <div className="text-xs text-white/70">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="font-display text-2xl text-foreground md:text-3xl">Pourquoi vendre sur Winstorr ?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Les 4 arguments qui comptent vraiment pour un commerçant camerounais.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: ShieldCheck,
              title: "Vous êtes payé après livraison confirmée",
              body: "Notre système d'escrow protège vendeurs et acheteurs. Vos gains sont sécurisés dès la confirmation de réception — plus jamais de \"le client dit qu'il n'a pas reçu\".",
              tint: "text-success bg-success/10",
            },
            {
              icon: CreditCard,
              title: "Nous gérons les paiements",
              body: "MTN Mobile Money, Orange Money et carte bancaire — sans configuration ni compte marchand. Le client paie, vous recevez, c'est tout.",
              tint: "text-primary bg-primary/10",
            },
            {
              icon: Truck,
              title: "Nos livreurs partenaires récupèrent chez vous",
              body: "Vous n'avez pas besoin de flotte, de coursiers ni de logistique. Nous prenons en charge la livraison de bout en bout.",
              tint: "text-accent bg-accent/10",
            },
            {
              icon: Store,
              title: "Votre boutique, sans site web",
              body: "Une page vitrine dédiée, un catalogue produits, des avis clients, tout inclus. Vous vous concentrez sur ce que vous vendez.",
              tint: "text-secondary bg-secondary/10",
            },
          ].map(({ icon: Icon, title, body, tint }) => (
            <div key={title} className="rounded-lg border border-border bg-card p-5">
              <div className={`grid h-10 w-10 place-items-center rounded-md ${tint}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <h2 className="font-display text-2xl text-foreground md:text-3xl">Comment ça marche</h2>
          <p className="mt-2 text-sm text-muted-foreground">Un parcours simple, encadré par notre équipe.</p>
          <ol className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              { n: "01", t: "Candidature", d: "Remplissez le formulaire ci-dessous. 5 minutes suffisent." },
              { n: "02", t: "Validation Wintek", d: "Notre équipe vous contacte sous 48h pour valider votre activité." },
              { n: "03", t: "Création de votre boutique", d: "Nous configurons votre vitrine et importons vos premiers produits." },
              { n: "04", t: "Vos premières ventes", d: "Votre boutique est en ligne. Les commandes commencent à arriver." },
            ].map((s) => (
              <li key={s.n} className="relative rounded-lg border border-border bg-card p-5">
                <div className="text-[11px] font-bold tracking-widest text-primary">ÉTAPE {s.n}</div>
                <div className="mt-1 text-base font-semibold text-foreground">{s.t}</div>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Commission transparency */}
      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-lg border border-border bg-card p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-accent/10 text-accent">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-xl text-foreground">Commission transparente</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Winstorr prélève <strong className="text-foreground">{commissionLabel}</strong> sur chaque vente réalisée sur la marketplace.
                Cette commission couvre la plateforme, le traitement des paiements, la logistique partagée et le service client.
                <span className="block mt-2">Aucun frais d'inscription. Aucun abonnement mensuel. Vous payez uniquement quand vous vendez.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Application form */}
      <section id="candidature" className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <h2 className="font-display text-2xl text-foreground md:text-3xl">Postuler</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Notre équipe examine chaque candidature manuellement pour garantir la qualité de la marketplace.
            Nous vous répondons sous 48h.
          </p>
          <ApplicationForm />
        </div>
      </section>
    </div>
  );
}

function ApplicationForm() {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    phone: "",
    email: "",
    city: "",
    product_type: PRODUCT_TYPE_OPTIONS[0],
    description: "",
    social_link: "",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!form.business_name.trim() || !form.contact_name.trim() || !form.phone.trim() || !form.city.trim() || !form.description.trim()) {
      toast.error("Merci de remplir tous les champs obligatoires.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("vendor_applications").insert({
      business_name: form.business_name.trim(),
      contact_name: form.contact_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      city: form.city.trim(),
      product_types: [form.product_type],
      description: form.description.trim(),
      social_link: form.social_link.trim() || null,
    });
    setBusy(false);
    if (error) {
      console.error("[vendor-application] insert error", error);
      toast.error("Échec de l'envoi. Réessayez ou contactez-nous sur WhatsApp.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mt-6 rounded-lg border border-success/40 bg-success/5 p-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="mt-3 font-display text-xl text-foreground">Candidature reçue</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Merci ! Notre équipe examine votre dossier et vous contacte sous <strong>48h</strong> au numéro fourni.
        </p>
        <div className="mt-5">
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-link-color">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-border bg-card p-5 md:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom du commerce" required>
          <Input value={form.business_name} onChange={(e) => update("business_name", e.target.value)} required maxLength={120} placeholder="Ex. Chez Awa Électronique" />
        </Field>
        <Field label="Nom du contact" required>
          <Input value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} required maxLength={120} placeholder="Votre nom complet" />
        </Field>
        <Field label="Téléphone (WhatsApp de préférence)" required>
          <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} required inputMode="tel" placeholder="+237 6 XX XX XX XX" />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" placeholder="vous@exemple.com" />
        </Field>
        <Field label="Ville" required>
          <Input value={form.city} onChange={(e) => update("city", e.target.value)} required placeholder="Douala, Yaoundé…" />
        </Field>
        <Field label="Type de produits vendus" required>
          <select
            value={form.product_type}
            onChange={(e) => update("product_type", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {PRODUCT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Décrivez brièvement votre activité" required>
        <Textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          required
          rows={4}
          maxLength={800}
          placeholder="Depuis quand vendez-vous ? Combien de références ? D'où venez-vous ?"
        />
      </Field>
      <Field label="Lien réseaux sociaux ou catalogue existant (optionnel)">
        <Input
          value={form.social_link}
          onChange={(e) => update("social_link", e.target.value)}
          placeholder="Facebook, Instagram, catalogue WhatsApp…"
        />
      </Field>
      <div className="pt-2">
        <Button type="submit" disabled={busy} className="w-full md:w-auto">
          {busy ? "Envoi…" : "Envoyer ma candidature"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          En envoyant ce formulaire, vous acceptez d'être contacté·e par l'équipe Winstorr.
        </p>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
