import { useRef, useState } from "react";
import { Upload, Loader2, Trash2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { uploadImageAt } from "@/lib/image-upload";

type Props = {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  /** Target width in px used for center-crop resizing. Also shown as guidance. */
  width: number;
  /** Target height in px used for center-crop resizing. Also shown as guidance. */
  height: number;
  label?: string;
  /** Storage folder inside product-images bucket. */
  folder?: string;
};

/**
 * Single-image uploader with drag & drop, custom recommended dimensions,
 * and center-crop resize to the exact target size (WebP).
 * Shape/aspect is enforced client-side so a slightly-off upload still looks correct.
 */
export function BannerImageUploader({ value, onChange, width, height, label = "Image", folder = "banners" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const paddingBottom = `${(height / width) * 100}%`;

  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImageAt(file, width, height, folder);
      onChange(url);
      toast.success("Image téléversée");
    } catch (e) {
      toast.error(`Échec de l'envoi : ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">
          Dimensions recommandées : {width}×{height}px
        </span>
      </div>

      {value ? (
        <div className="relative overflow-hidden rounded-sm border border-border bg-muted">
          <div style={{ paddingBottom }} />
          <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-sm bg-background/90 px-2 py-1 text-xs shadow hover:bg-background"
            >
              Remplacer
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-sm bg-background/90 p-1.5 text-destructive shadow hover:bg-background"
              aria-label="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void doUpload(f);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed px-3 py-6 text-center text-xs transition",
            dragOver ? "border-secondary bg-secondary/5" : "border-border bg-muted/40 hover:bg-muted",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Envoi en cours…</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Glissez-déposez une image ou cliquez pour parcourir</span>
              <span className="text-muted-foreground">
                JPG, PNG, WEBP — recadrée automatiquement en {width}×{height}px
              </span>
            </>
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void doUpload(f);
          e.target.value = "";
        }}
      />

      <div className="flex items-end gap-2 pt-1">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Ou coller une URL externe</Label>
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://…"
              className="pl-7"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={() => {
            const v = urlInput.trim();
            if (v) {
              onChange(v);
              setUrlInput("");
            }
          }}
          disabled={!urlInput.trim()}
        >
          Utiliser
        </Button>
      </div>
    </div>
  );
}
