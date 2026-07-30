import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyFinancingPartners, type FinancingPartner } from "@/lib/financing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/partenaire/profil")({
  component: PartnerProfile,
});

function PartnerProfile() {
  const qc = useQueryClient();
  const { data: memberships } = useMyFinancingPartners();
  const partnerId = memberships?.[0]?.financing_partner_id;

  const { data: partner } = useQuery({
    queryKey: ["partner-profile", partnerId],
    enabled: !!partnerId,
    queryFn: async (): Promise<FinancingPartner | null> => {
      const { data, error } = await supabase
        .from("financing_partners")
        .select("id, name, slug, logo_url, description, contact_phone, contact_email, min_product_price, default_terms_description, is_active")
        .eq("id", partnerId!)
        .maybeSingle();
      if (error) throw error;
      return (data as FinancingPartner) ?? null;
    },
  });

  const [desc, setDesc] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [terms, setTerms] = useState("");

  useEffect(() => {
    if (!partner) return;
    setDesc(partner.description ?? "");
    setPhone(partner.contact_phone ?? "");
    setEmail(partner.contact_email ?? "");
    setLogo(partner.logo_url ?? "");
    setMinPrice(String(partner.min_product_price ?? ""));
    setTerms(partner.default_terms_description ?? "");
  }, [partner]);

  const save = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error("Aucun partenaire");
      const { error } = await supabase
        .from("financing_partners")
        .update({
          description: desc,
          contact_phone: phone,
          contact_email: email || null,
          logo_url: logo || null,
          min_product_price: Number(minPrice) || 0,
          default_terms_description: terms || null,
        })
        .eq("id", partnerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuration mise à jour");
      qc.invalidateQueries({ queryKey: ["partner-profile", partnerId] });
      qc.invalidateQueries({ queryKey: ["financing-partner-active"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="font-display text-2xl text-foreground">Ma configuration</h2>
      <p className="text-sm text-muted-foreground">
        Ces informations apparaissent aux clients sur les fiches produit éligibles au paiement échelonné.
      </p>
      <div className="space-y-4 rounded-sm border border-border bg-card p-5">
        <div><Label>Description affichée</Label><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} /></div>
        <div><Label>Conditions indicatives</Label><Textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={300} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Téléphone / WhatsApp</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div><Label>Logo (URL)</Label><Input value={logo} onChange={(e) => setLogo(e.target.value)} /></div>
        <div>
          <Label>Prix minimum du produit (FCFA)</Label>
          <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">En dessous de ce montant, l'offre de financement n'est pas proposée.</p>
        </div>
        <div className="flex justify-end">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
