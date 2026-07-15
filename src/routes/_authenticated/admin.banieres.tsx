import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { BannerImageUploader } from "@/components/banner-image-uploader";
import { ConfirmDialog } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/admin/banieres")({
  component: AdminBannersPage,
});

type BannerType = "hero_slide" | "promo_tile" | "category_tile";

type Banner = {
  id: string;
  type: BannerType;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_label: string | null;
  link_url: string | null;
  background_color: string | null;
  category_id: string | null;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

type CatRow = { id: string; name: string; slug: string; product_type: string | null };

const TYPE_META: Record<BannerType, { label: string; width: number; height: number; help: string }> = {
  hero_slide: {
    label: "Slides Hero",
    width: 1600,
    height: 500,
    help: "Grand bandeau en haut de l'accueil (1600×500px).",
  },
  promo_tile: {
    label: "Tuiles Promo",
    width: 600,
    height: 600,
    help: "Carrés promotionnels sous le hero (600×600px).",
  },
  category_tile: {
    label: "Tuiles Catégories",
    width: 800,
    height: 450,
    help: 'Grille « Explorez Winstorr » (800×450px).',
  },
};

const LINK_PRESETS: { label: string; value: string }[] = [
  { label: "Catalogue complet", value: "/catalogue" },
  { label: "Produits vérifiés", value: "/catalogue?verified=true" },
  { label: "Physiques", value: "/catalogue?type=physical" },
  { label: "Numériques", value: "/catalogue?type=digital" },
  { label: "Services", value: "/catalogue?type=service" },
  { label: "Formations", value: "/catalogue?type=training" },
  { label: "Toutes les boutiques", value: "/boutiques" },
];

function AdminBannersPage() {
  const [tab, setTab] = useState<BannerType>("hero_slide");
  const qc = useQueryClient();

  const { data: banners = [], isPending } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_banners")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Banner[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-banners-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, product_type")
        .eq("status", "active")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as CatRow[];
    },
  });

  const filtered = useMemo(() => banners.filter((b) => b.type === tab), [banners, tab]);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [creating, setCreating] = useState<BannerType | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
    qc.invalidateQueries({ queryKey: ["homepage-banners"] });
  };

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("homepage_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bannière supprimée");
      invalidate();
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: -1 | 1 }) => {
      const list = filtered;
      const idx = list.findIndex((b) => b.id === id);
      const swapIdx = idx + direction;
      if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
      const a = list[idx];
      const b = list[swapIdx];
      const { error: e1 } = await supabase
        .from("homepage_banners")
        .update({ display_order: b.display_order })
        .eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("homepage_banners")
        .update({ display_order: a.display_order })
        .eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (b: Banner) => {
      const { error } = await supabase
        .from("homepage_banners")
        .update({ is_active: !b.is_active })
        .eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-foreground">Bannières & tuiles</h1>
          <p className="text-sm text-muted-foreground">
            Gérez les visuels de la page d'accueil : hero, tuiles promo et catégories.
          </p>
        </div>
        <Button onClick={() => setCreating(tab)}>
          <Plus className="mr-1 h-4 w-4" /> Nouvelle {TYPE_META[tab].label.toLowerCase().slice(0, -1)}
        </Button>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {(Object.keys(TYPE_META) as BannerType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{TYPE_META[tab].help}</p>

      {isPending ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Aucune bannière pour le moment. Cliquez sur « Nouvelle » pour en créer une.
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3 w-24">Image</th>
                <th className="p-3">Titre</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Ordre</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => {
                const status = statusOf(b);
                return (
                  <tr key={b.id} className="border-t border-border">
                    <td className="p-2">
                      {b.image_url ? (
                        <img src={b.image_url} alt="" className="h-12 w-20 rounded-sm object-cover" />
                      ) : (
                        <div className="grid h-12 w-20 place-items-center rounded-sm bg-muted text-[10px] text-muted-foreground">Sans image</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{b.title}</div>
                      {b.subtitle && <div className="text-xs text-muted-foreground line-clamp-1">{b.subtitle}</div>}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleActive.mutate(b)}
                        className={cn(
                          "rounded-sm px-2 py-0.5 text-xs font-medium",
                          status === "active" && "bg-success/15 text-success",
                          status === "scheduled" && "bg-secondary/15 text-secondary",
                          status === "expired" && "bg-muted text-muted-foreground",
                          status === "inactive" && "bg-destructive/10 text-destructive",
                        )}
                      >
                        {status === "active" && "Actif"}
                        {status === "scheduled" && "Programmé"}
                        {status === "expired" && "Expiré"}
                        {status === "inactive" && "Inactif"}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => move.mutate({ id: b.id, direction: -1 })}
                          disabled={i === 0}
                          className="rounded p-1 hover:bg-muted disabled:opacity-30"
                          aria-label="Monter"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => move.mutate({ id: b.id, direction: 1 })}
                          disabled={i === filtered.length - 1}
                          className="rounded p-1 hover:bg-muted disabled:opacity-30"
                          aria-label="Descendre"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <span className="ml-1 text-xs text-muted-foreground">{b.display_order}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteId(b.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(editing || creating) && (
        <BannerEditor
          type={editing?.type ?? creating!}
          banner={editing}
          categories={categories}
          maxOrder={Math.max(0, ...filtered.map((b) => b.display_order))}
          onClose={() => {
            setEditing(null);
            setCreating(null);
          }}
          onSaved={() => {
            invalidate();
            setEditing(null);
            setCreating(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer cette bannière ?"
        description="Cette action est définitive."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={() => deleteId && del.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function statusOf(b: Banner): "active" | "inactive" | "scheduled" | "expired" {
  if (!b.is_active) return "inactive";
  const now = Date.now();
  if (b.starts_at && new Date(b.starts_at).getTime() > now) return "scheduled";
  if (b.ends_at && new Date(b.ends_at).getTime() < now) return "expired";
  return "active";
}

function toLocalInput(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

function BannerEditor({
  type,
  banner,
  categories,
  maxOrder,
  onClose,
  onSaved,
}: {
  type: BannerType;
  banner: Banner | null;
  categories: CatRow[];
  maxOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const meta = TYPE_META[type];
  const [title, setTitle] = useState(banner?.title ?? "");
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? "");
  const [image, setImage] = useState<string | null>(banner?.image_url ?? null);
  const [cta, setCta] = useState(banner?.cta_label ?? "");
  const [link, setLink] = useState(banner?.link_url ?? "");
  const [bg, setBg] = useState(banner?.background_color ?? "");
  const [categoryId, setCategoryId] = useState(banner?.category_id ?? "");
  const [isActive, setIsActive] = useState(banner?.is_active ?? true);
  const [startsAt, setStartsAt] = useState(toLocalInput(banner?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(banner?.ends_at ?? null));

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Le titre est requis");
      const payload = {
        type,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        image_url: image,
        cta_label: cta.trim() || null,
        link_url: type === "category_tile" ? categoryLink(categoryId, categories) : link.trim() || null,
        background_color: bg.trim() || null,
        category_id: type === "category_tile" ? categoryId || null : null,
        is_active: isActive,
        starts_at: fromLocalInput(startsAt),
        ends_at: fromLocalInput(endsAt),
        display_order: banner?.display_order ?? maxOrder + 10,
      };
      if (banner) {
        const { error } = await supabase.from("homepage_banners").update(payload).eq("id", banner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("homepage_banners").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(banner ? "Bannière mise à jour" : "Bannière créée");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="my-6 w-full max-w-2xl rounded-sm border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl text-foreground">
              {banner ? "Modifier" : "Nouvelle"} — {meta.label.replace(/s$/, "")}
            </h2>
            <p className="text-xs text-muted-foreground">{meta.help}</p>
          </div>
          <button onClick={onClose} className="rounded-sm px-2 py-1 text-sm text-muted-foreground hover:bg-muted">Fermer</button>
        </div>

        <div className="space-y-4">
          <BannerImageUploader
            label="Image"
            width={meta.width}
            height={meta.height}
            value={image}
            onChange={setImage}
          />

          <div>
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>

          <div>
            <Label>Sous-titre</Label>
            <Textarea rows={2} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={300} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Texte du bouton (CTA)</Label>
              <Input value={cta} onChange={(e) => setCta(e.target.value)} maxLength={40} placeholder="Découvrir" />
            </div>
            <div>
              <Label>Couleur d'arrière-plan (fallback)</Label>
              <Input value={bg} onChange={(e) => setBg(e.target.value)} placeholder="#0D2C54 ou gradient CSS" />
            </div>
          </div>

          {type === "category_tile" ? (
            <div>
              <Label>Catégorie *</Label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
              >
                <option value="">— Choisir —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Le lien pointe automatiquement vers le catalogue filtré par cette catégorie.
              </p>
            </div>
          ) : (
            <div>
              <Label>Destination du lien</Label>
              <div className="flex gap-2">
                <select
                  value=""
                  onChange={(e) => e.target.value && setLink(e.target.value)}
                  className="flex h-9 w-40 rounded-sm border border-input bg-background px-2 text-sm"
                >
                  <option value="">Presets…</option>
                  {LINK_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/catalogue?verified=true" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Démarrage (optionnel)</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label>Fin (optionnel)</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Actif (affiché en front)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function categoryLink(categoryId: string, categories: CatRow[]): string | null {
  const c = categories.find((x) => x.id === categoryId);
  if (!c) return null;
  const params = new URLSearchParams();
  params.set("category", c.slug);
  if (c.product_type) params.set("type", c.product_type);
  return `/catalogue?${params.toString()}`;
}
