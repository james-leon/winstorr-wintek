import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyVendors } from "@/lib/vendor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BannerImageUploader } from "@/components/banner-image-uploader";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/vendeur/boutique")({
  component: VendorStorefrontEditor,
});

type Socials = { whatsapp?: string; facebook?: string; instagram?: string };

function VendorStorefrontEditor() {
  const { data: memberships } = useMyVendors();
  const vendorId = memberships?.[0]?.vendor_id;
  const qc = useQueryClient();

  const { data: storefront } = useQuery({
    queryKey: ["vendor-storefront", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_storefronts")
        .select("banner_url, description, social_links, policies")
        .eq("vendor_id", vendorId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [banner, setBanner] = useState("");
  const [desc, setDesc] = useState("");
  const [policies, setPolicies] = useState("");
  const [socials, setSocials] = useState<Socials>({});

  useEffect(() => {
    if (!storefront) return;
    setBanner(storefront.banner_url ?? "");
    setDesc(storefront.description ?? "");
    setPolicies(storefront.policies ?? "");
    setSocials((storefront.social_links as Socials) ?? {});
  }, [storefront]);

  const save = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error("Aucun vendeur");
      const payload = {
        vendor_id: vendorId,
        banner_url: banner || null,
        description: desc || null,
        policies: policies || null,
        social_links: socials as unknown as Record<string, string>,
      };
      const { error } = await supabase
        .from("vendor_storefronts")
        .upsert(payload, { onConflict: "vendor_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Boutique mise à jour");
      qc.invalidateQueries({ queryKey: ["vendor-storefront", vendorId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: vendorRow } = useQuery({
    queryKey: ["vendor-allow-financing", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("allow_financing").eq("id", vendorId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const toggleFinancing = useMutation({
    mutationFn: async (allow: boolean) => {
      if (!vendorId) throw new Error("Aucun vendeur");
      const { data, error } = await supabase.rpc("set_vendor_allow_financing", { _vendor_id: vendorId, _allow: allow });
      if (error) throw error;
      const r = data as { ok: boolean; reason?: string };
      if (!r.ok) throw new Error(r.reason ?? "Erreur");
    },
    onSuccess: () => {
      toast.success("Préférence enregistrée");
      qc.invalidateQueries({ queryKey: ["vendor-allow-financing", vendorId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="font-display text-2xl text-foreground">Ma boutique</h2>
      <p className="text-sm text-muted-foreground">
        Personnalisez la page publique de votre boutique. Visible sur /boutiques/{memberships?.[0]?.vendor.slug ?? "…"}
      </p>

      <div className="space-y-4 rounded-sm border border-border bg-card p-5">
        <BannerImageUploader
          label="Bannière de la boutique"
          width={1600}
          height={400}
          folder="storefront-banners"
          value={banner || null}
          onChange={(v) => setBanner(v ?? "")}
        />


        <div>
          <Label>Description (« À propos »)</Label>
          <Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={1000} placeholder="Présentez votre boutique en quelques lignes…" />
        </div>

        <div>
          <Label>Politiques (retours, livraison…)</Label>
          <Textarea rows={4} value={policies} onChange={(e) => setPolicies(e.target.value)} maxLength={2000} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label>WhatsApp</Label>
            <Input value={socials.whatsapp ?? ""} onChange={(e) => setSocials((s) => ({ ...s, whatsapp: e.target.value }))} placeholder="+237…" />
          </div>
          <div>
            <Label>Facebook</Label>
            <Input value={socials.facebook ?? ""} onChange={(e) => setSocials((s) => ({ ...s, facebook: e.target.value }))} />
          </div>
          <div>
            <Label>Instagram</Label>
            <Input value={socials.instagram ?? ""} onChange={(e) => setSocials((s) => ({ ...s, instagram: e.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-sm border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-display text-lg text-foreground">Autoriser le paiement échelonné</div>
            <p className="mt-1 text-sm text-muted-foreground">
              En activant cette option, vous autorisez nos partenaires financiers (comme MC Leasing) à proposer le
              paiement en plusieurs fois à vos clients sur vos produits éligibles.
            </p>
          </div>
          <Switch
            checked={!!vendorRow?.allow_financing}
            disabled={toggleFinancing.isPending || !vendorId}
            onCheckedChange={(v) => toggleFinancing.mutate(v)}
          />
        </div>
        <div className="rounded-sm border border-accent/30 bg-accent/5 p-3 text-sm text-foreground">
          <strong>Vous ne prêtez pas d'argent vous-même.</strong> Vous êtes payé normalement pour votre vente — c'est le
          partenaire financier qui gère le financement, le contrat et en assume le risque. Winstorr transmet simplement
          la demande du client au partenaire.
        </div>
      </div>
    </div>
  );
}
