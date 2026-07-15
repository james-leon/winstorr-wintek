import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Star, Trash2, Plus, Link as LinkIcon, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { uploadProductImage } from "@/lib/image-upload";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

/**
 * Multi-image manager for product forms.
 * - Preview thumbnails in the current order (first = cover)
 * - Add via URL (paste one or more, one per line)
 * - Remove any image
 * - Reorder with left/right (or up/down on wrap) controls
 * - Set any image as cover in one click
 *
 * Note: direct file upload to Storage requires enabling public buckets in
 * Cloud settings. Until then, paste image URLs (e.g. Unsplash, CDN, or an
 * existing public bucket URL).
 */
export function ImageGalleryManager({ value, onChange }: Props) {
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading((n) => n + list.length);
    const uploaded: string[] = [];
    for (const f of list) {
      try {
        const url = await uploadProductImage(f);
        uploaded.push(url);
      } catch (e) {
        toast.error(`Échec de l'envoi : ${(e as Error).message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (uploaded.length) {
      onChange([...value, ...uploaded]);
      toast.success(`${uploaded.length} image${uploaded.length > 1 ? "s" : ""} ajoutée${uploaded.length > 1 ? "s" : ""}.`);
    }
  };

  const add = () => {
    const items = urlInput
      .split(/\s|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (!items.length) return;
    onChange([...value, ...items]);
    setUrlInput("");
  };

  const remove = (i: number) => {
    const next = value.slice();
    next.splice(i, 1);
    onChange(next);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = value.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const makeCover = (i: number) => move(i, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Images du produit</Label>
        <span className="text-xs text-muted-foreground">
          {value.length} image{value.length > 1 ? "s" : ""} · 1ʳᵉ = couverture
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed px-3 py-4 text-center text-xs transition",
          dragOver ? "border-secondary bg-secondary/5" : "border-border bg-muted/40 hover:bg-muted",
        )}
      >
        {uploading > 0 ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Envoi de {uploading} image{uploading > 1 ? "s" : ""}…</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-foreground">Glissez-déposez vos images ici ou cliquez pour parcourir</span>
            <span className="text-muted-foreground">JPG, PNG, WEBP — redimensionnées automatiquement en carré (1000×1000)</span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Astuce : 3 à 4 photos minimum (angles différents, emballage, détails).
        </p>
      )}

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {value.map((src, i) => (
            <div
              key={`${i}-${src}`}
              draggable
              onDragStart={() => (dragIdx.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx.current !== null && dragIdx.current !== i) move(dragIdx.current, i);
                dragIdx.current = null;
              }}
              className={cn(
                "group relative overflow-hidden rounded-sm border bg-muted",
                i === 0 ? "border-secondary ring-1 ring-secondary/40" : "border-border",
              )}
            >
              <div className="aspect-square">
                <img
                  src={src}
                  alt={`Image ${i + 1}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                  }}
                />
              </div>
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  Couverture
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-0.5 bg-background/85 p-1 opacity-0 backdrop-blur transition group-hover:opacity-100">
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    aria-label="Déplacer vers la gauche"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    className="rounded p-1 hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Déplacer vers la droite"
                    onClick={() => move(i, i + 1)}
                    disabled={i === value.length - 1}
                    className="rounded p-1 hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  {i !== 0 && (
                    <button
                      type="button"
                      aria-label="Définir comme couverture"
                      onClick={() => makeCover(i)}
                      className="rounded p-1 hover:bg-muted"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Supprimer"
                  onClick={() => remove(i)}
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 pt-1">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Ou coller une URL externe (une par ligne)</Label>
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="https://... https://..."
              className="pl-7"
            />
          </div>
        </div>
        <Button type="button" onClick={add} disabled={!urlInput.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Ajouter
        </Button>
      </div>

      {value.length > 0 && value.length < 3 && (
        <p className="text-xs text-muted-foreground">
          Astuce : ajoutez au moins 3-4 photos (angles différents, emballage, détails) pour rassurer vos clients.
        </p>
      )}
    </div>
  );
}
