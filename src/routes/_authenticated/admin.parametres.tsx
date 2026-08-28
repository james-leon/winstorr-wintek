import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { normalizePhoneCM } from "@/lib/whatsapp";
import { PROMO_BAR_KEY, type PromoBarSetting } from "@/components/promo-bar";

export const Route = createFileRoute("/_authenticated/admin/parametres")({
  component: AdminSettings,
});

function AdminSettings() {
  const qc = useQueryClient();

  const waQ = useQuery({
    queryKey: ["settings", "whatsapp_support_number"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_support_number")
        .maybeSingle();
      const v = data?.value as { number?: string } | string | null;
      return typeof v === "string" ? v : v?.number ?? "";
    },
  });
  const [waNumber, setWaNumber] = useState<string>("");
  useEffect(() => {
    if (waQ.data) setWaNumber(waQ.data);
  }, [waQ.data]);

  const saveWa = useMutation({
    mutationFn: async (num: string) => {
      const normalized = normalizePhoneCM(num);
      if (!normalized) throw new Error("Numéro invalide.");
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "whatsapp_support_number", value: { number: normalized } });
      if (error) throw error;
      return normalized;
    },
    onSuccess: (normalized) => {
      setWaNumber(normalized);
      toast.success("Numéro WhatsApp support enregistré.");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-support-number"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preview = normalizePhoneCM(waNumber);

  // ---- Promo bar ----
  const promoQ = useQuery({
    queryKey: ["settings", PROMO_BAR_KEY],
    queryFn: async (): Promise<PromoBarSetting> => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", PROMO_BAR_KEY)
        .maybeSingle();
      return (data?.value as PromoBarSetting | null) ?? {};
    },
  });
  const [promo, setPromo] = useState<PromoBarSetting>({});
  useEffect(() => {
    if (promoQ.data) setPromo(promoQ.data);
  }, [promoQ.data]);

  const savePromo = useMutation({
    mutationFn: async (v: PromoBarSetting) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: PROMO_BAR_KEY, value: v as never });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bandeau promo enregistré.");
      qc.invalidateQueries({ queryKey: ["settings", PROMO_BAR_KEY] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setP = (patch: Partial<PromoBarSetting>) => setPromo((prev) => ({ ...prev, ...patch }));

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-sm border border-border bg-card p-4">
        <h2 className="font-semibold">Contact & WhatsApp</h2>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          Ce numéro est utilisé partout sur le site : section WhatsApp de la page d'accueil,
          footer (« Nous contacter sur WhatsApp »), page de confirmation de commande et
          boutons de contact vendeur quand la boutique n'a pas de numéro propre.
        </p>
        <Label htmlFor="wa-support" className="text-sm font-medium">
          Numéro WhatsApp support (client → Winstorr)
        </Label>
        <div className="mt-1 flex gap-2">
          <Input
            id="wa-support"
            placeholder="Ex : 237 6XX XX XX XX"
            value={waNumber}
            onChange={(e) => setWaNumber(e.target.value)}
            className="max-w-xs"
          />
          <Button
            size="sm"
            onClick={() => saveWa.mutate(waNumber)}
            disabled={saveWa.isPending || !preview}
          >
            Enregistrer
          </Button>
        </div>
        {preview && (
          <p className="mt-2 text-xs text-muted-foreground">
            Lien généré : <span className="font-mono">https://wa.me/{preview}</span>
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Format international sans espaces ni symboles. La normalisation est automatique
          (ex. « +237 690 72 23 16 » → 237690722316).
        </p>
      </section>

      <section className="rounded-sm border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Bandeau promo / coupon (page d'accueil)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Affiché sous le hero. S'il est désactivé ou sans message, le bandeau est
              entièrement masqué.
            </p>
          </div>
          <Switch
            checked={!!promo.active}
            onCheckedChange={(v) => setP({ active: v })}
            aria-label="Activer le bandeau promo"
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-sm font-medium">Message (FR)</Label>
            <Textarea
              rows={2}
              value={promo.message ?? ""}
              onChange={(e) => setP({ message: e.target.value })}
              placeholder="🎁 Offre de lancement — Vendez sans commission jusqu'à fin 2026 !"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-sm font-medium">Message (EN)</Label>
            <Textarea
              rows={2}
              value={promo.message_en ?? ""}
              onChange={(e) => setP({ message_en: e.target.value })}
              placeholder="Launch offer — sell commission-free until end of 2026!"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Code promo (optionnel)</Label>
            <Input
              value={promo.code ?? ""}
              onChange={(e) => setP({ code: e.target.value.toUpperCase() })}
              placeholder="BIENVENUE2026"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Lien du bouton (optionnel)</Label>
            <Input
              value={promo.cta_link ?? ""}
              onChange={(e) => setP({ cta_link: e.target.value })}
              placeholder="/catalogue"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Libellé bouton (FR)</Label>
            <Input
              value={promo.cta_label ?? ""}
              onChange={(e) => setP({ cta_label: e.target.value })}
              placeholder="J'en profite"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Libellé bouton (EN)</Label>
            <Input
              value={promo.cta_label_en ?? ""}
              onChange={(e) => setP({ cta_label_en: e.target.value })}
              placeholder="Shop the offer"
            />
          </div>
        </div>

        <Button
          size="sm"
          className="mt-4"
          onClick={() => savePromo.mutate(promo)}
          disabled={savePromo.isPending}
        >
          Enregistrer le bandeau
        </Button>
      </section>
    </div>
  );
}
