import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyVendors } from "@/lib/vendor";

export const Route = createFileRoute("/_authenticated/vendeur/annonces")({
  component: VendorAnnouncements,
});

function VendorAnnouncements() {
  const { data: memberships } = useMyVendors();
  const vendorId = memberships?.[0]?.vendor_id;

  const { data: items = [] } = useQuery({
    queryKey: ["vendor-announcements", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_announcements")
        .select("id, title, message, created_at, vendor_id")
        .or(`vendor_id.is.null,vendor_id.eq.${vendorId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl text-foreground">Annonces de l'équipe Wintek</h2>
      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="flex gap-3 rounded-sm border border-border bg-card p-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{new Date(a.created_at).toLocaleDateString("fr-FR")}</span>
                {a.vendor_id === null && <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-secondary">Diffusion générale</span>}
              </div>
              <h3 className="mt-1 text-sm font-semibold text-foreground">{a.title}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.message}</p>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-sm border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Aucune annonce.
          </div>
        )}
      </div>
    </div>
  );
}
