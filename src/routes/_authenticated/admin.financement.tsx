import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatFcfa } from "@/lib/format";
import type { FinancingPartner } from "@/lib/financing";
import { FinancingRequestsTable, useFinancingRequests } from "@/components/financing-requests-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/financement")({
  component: AdminFinancing,
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function AdminFinancing() {
  const qc = useQueryClient();
  const { data: requests = [] } = useFinancingRequests(null);

  const { data: partners = [] } = useQuery({
    queryKey: ["admin-financing-partners"],
    queryFn: async (): Promise<FinancingPartner[]> => {
      const { data, error } = await supabase
        .from("financing_partners")
        .select("id, name, slug, logo_url, description, contact_phone, contact_email, min_product_price, default_terms_description, is_active")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FinancingPartner[];
    },
  });

  const [editing, setEditing] = useState<FinancingPartner | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-foreground">Financement</h1>
        <p className="text-sm text-muted-foreground">
          Partenaires financiers et demandes de paiement échelonné. Winstorr ne prête pas d'argent : le partenaire gère
          le contrat et le risque hors plateforme.
        </p>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Demandes ({requests.length})</TabsTrigger>
          <TabsTrigger value="partners">Partenaires ({partners.length})</TabsTrigger>
          <TabsTrigger value="invites">Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <FinancingRequestsTable rows={requests} showPartner invalidateKey={["all"]} />
        </TabsContent>

        <TabsContent value="partners" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Nouveau partenaire
            </Button>
          </div>
          {partners.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-card p-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  {p.name} {!p.is_active && <span className="text-xs text-muted-foreground">(inactif)</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  Min. {formatFcfa(Number(p.min_product_price))} · {p.contact_phone || "—"} · {p.contact_email || "—"}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setEditing(p); setDialogOpen(true); }}>Modifier</Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="invites" className="mt-4">
          <PartnerInvitations partners={partners} />
        </TabsContent>
      </Tabs>

      <PartnerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        partner={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["admin-financing-partners"] })}
      />
    </div>
  );
}

function PartnerDialog({
  open, onOpenChange, partner, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; partner: FinancingPartner | null; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState("");
  const [minPrice, setMinPrice] = useState("100000");
  const [terms, setTerms] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(partner?.name ?? "");
    setDesc(partner?.description ?? "");
    setPhone(partner?.contact_phone ?? "");
    setEmail(partner?.contact_email ?? "");
    setLogo(partner?.logo_url ?? "");
    setMinPrice(String(partner?.min_product_price ?? 100000));
    setTerms(partner?.default_terms_description ?? "");
    setActive(partner?.is_active ?? true);
  }, [open, partner]);

  const save = useMutation({
    mutationFn: async () => {
      if (name.trim().length < 2) throw new Error("Nom requis.");
      const payload = {
        name: name.trim(),
        description: desc,
        contact_phone: phone,
        contact_email: email || null,
        logo_url: logo || null,
        min_product_price: Number(minPrice) || 0,
        default_terms_description: terms || null,
        is_active: active,
      };
      if (partner) {
        const { error } = await supabase.from("financing_partners").update(payload).eq("id", partner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("financing_partners")
          .insert({ ...payload, slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}` });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Partenaire enregistré"); onSaved(); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{partner ? "Modifier le partenaire" : "Nouveau partenaire financier"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description (affichée aux clients)</Label><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Téléphone / WhatsApp</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <div><Label>Logo (URL)</Label><Input value={logo} onChange={(e) => setLogo(e.target.value)} /></div>
          <div><Label>Prix minimum du produit (FCFA)</Label><Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} /></div>
          <div><Label>Conditions indicatives</Label><Textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><Label>Actif</Label></div>
          <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>Enregistrer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PartnerInvitations({ partners }: { partners: FinancingPartner[] }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [partnerName, setPartnerName] = useState("");

  const { data: invites = [] } = useQuery({
    queryKey: ["financing-partner-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_partner_invitations")
        .select("id, email, token, status, expires_at, created_at, proposed_partner_name, financing_partner_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!email.includes("@")) throw new Error("Email invalide.");
      const { error } = await supabase.from("financing_partner_invitations").insert({
        email: email.trim(),
        proposed_partner_name: partnerName.trim() || null,
        token: randomToken(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation créée — copiez le lien et envoyez-le au partenaire.");
      setEmail(""); setPartnerName("");
      qc.invalidateQueries({ queryKey: ["financing-partner-invitations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const link = (token: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/partenaire/invitation/${token}`;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-sm border border-border bg-card p-4">
        <div className="text-sm font-semibold text-foreground">Inviter un partenaire financier</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@mcleasing.cm" /></div>
          <div><Label>Nom du partenaire (si nouveau)</Label><Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="MC Leasing" /></div>
        </div>
        <p className="text-xs text-muted-foreground">
          Laissez le nom vide pour rattacher l'invité à un partenaire existant depuis la base. Partenaires existants :{" "}
          {partners.map((p) => p.name).join(", ") || "—"}
        </p>
        <Button size="sm" disabled={create.isPending} onClick={() => create.mutate()}>Créer l'invitation</Button>
      </div>

      <div className="space-y-2">
        {invites.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-card p-3">
            <div className="min-w-0">
              <div className="text-sm text-foreground">{i.email} · <span className="text-xs text-muted-foreground">{i.status}</span></div>
              <div className="truncate text-[11px] text-muted-foreground">{link(i.token)}</div>
            </div>
            <Button
              size="sm" variant="outline"
              onClick={() => { void navigator.clipboard.writeText(link(i.token)); toast.success("Lien copié"); }}
            >
              <Copy className="mr-1 h-3.5 w-3.5" /> Copier
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
