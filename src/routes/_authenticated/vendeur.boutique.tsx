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

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="font-display text-2xl text-foreground">Ma boutique</h2>
      <p className="text-sm text-muted-foreground">
        Personnalisez la page publique de votre boutique. Visible sur /boutiques/{memberships?.[0]?.vendor.slug ?? "…"}
      </p>

      <div className="space-y-4 rounded-sm border border-border bg-card p-5">
        <div>
          <Label>Bannière (URL image)</Label>
          <Input value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="https://…" />
          {banner && <img src={banner} alt="" className="mt-2 aspect-[16/5] w-full rounded-sm object-cover" />}
        </div>

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
    </div>
  );
}
