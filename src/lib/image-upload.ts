import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";
const MAX_SIZE = 1000; // px
const QUALITY = 0.85;

/**
 * Resize a File to a square (1:1) WebP at MAX_SIZE, center-cropped.
 * Returns a Blob ready to upload.
 */
export async function resizeToSquareWebp(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Image invalide"));
    im.src = dataUrl;
  });

  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = MAX_SIZE;
  canvas.height = MAX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non supporté");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, MAX_SIZE, MAX_SIZE);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Conversion échouée"))),
      "image/webp",
      QUALITY,
    );
  });
}

export async function uploadProductImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Fichier non image");
  const blob = await resizeToSquareWebp(file);
  const name = `${crypto.randomUUID()}.webp`;
  const path = `${new Date().getFullYear()}/${name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
