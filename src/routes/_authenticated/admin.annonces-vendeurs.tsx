import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/admin/annonces-vendeurs")({
  component: AdminAnnouncements,
});

function AdminAnnouncements() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-vendor-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_announcements")
        .select("id, title, message, created_at, vendor_id, vendors:vendor_id(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Annonce supprimée"); qc.invalidateQueries({ queryKey: ["admin-vendor-announcements"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-foreground">Annonces vendeurs</h2>
        <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Nouvelle annonce</Button>
      </div>

      <div className="space-y-3">
        {rows.map((a) => (
          <div key={a.id} className="rounded-sm border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("fr-FR")} ·{" "}
                  {a.vendor_id ? `→ ${(a as { vendors?: { name: string } | null }).vendors?.name ?? "Vendeur"}` : "Diffusion générale"}
                </div>
                <h3 className="mt-1 font-semibold">{a.title}</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.message}</p>
              </div>
              <ConfirmDialog
                trigger={<Button size="sm" variant="ghost"><Trash2 className="h-3.5 w-3.5" /></Button>}
                title="Supprimer cette annonce ?"
                onConfirm={() => del.mutate(a.id)}
              />
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-sm border border-border bg-card p-6 text-center text-sm text-muted-foreground">Aucune annonce.</div>}
      </div>

      {open && <CreateAnnouncementDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-vendor-announcements"] }); }} />}
    </div>
  );
}

function CreateAnnouncementDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [target, setTarget] = useState<"all" | "one">("all");
  const [vendorId, setVendorId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-vendors-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, name").eq("status", "active").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vendor_announcements").insert({
        vendor_id: target === "one" ? vendorId : null,
        title,
        message,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Annonce envoyée"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle annonce</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Destinataire *</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as "all" | "one")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les vendeurs</SelectItem>
                <SelectItem value="one">Un vendeur précis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {target === "one" && (
            <div>
              <Label>Vendeur *</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Titre *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
          <div><Label>Message *</Label><Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={mut.isPending || !title || !message || (target === "one" && !vendorId)} onClick={() => mut.mutate()}>
            {mut.isPending ? "…" : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
