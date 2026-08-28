import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizePhoneCM } from "@/lib/whatsapp";

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
    </div>
  );
}
