import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";
const MAX_SIZE = 1000; // square product images
const QUALITY = 0.85;

/**
 * Resize a File by center-cropping to fit a target width×height, output WebP.
 * Any input aspect ratio is accepted — the image is cropped to fill the target box.
 */
export async function resizeToWebp(
  file: File,
  targetWidth: number,
  targetHeight: number,
  quality = QUALITY,
): Promise<Blob> {
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

  const targetRatio = targetWidth / targetHeight;
  const srcRatio = img.naturalWidth / img.naturalHeight;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (srcRatio > targetRatio) {
    sw = Math.round(img.naturalHeight * targetRatio);
    sx = Math.round((img.naturalWidth - sw) / 2);
  } else if (srcRatio < targetRatio) {
    sh = Math.round(img.naturalWidth / targetRatio);
    sy = Math.round((img.naturalHeight - sh) / 2);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non supporté");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Conversion échouée"))),
      "image/webp",
      quality,
    );
  });
}

export function resizeToSquareWebp(file: File): Promise<Blob> {
  return resizeToWebp(file, MAX_SIZE, MAX_SIZE);
}

export async function uploadProductImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Fichier non image");
  const blob = await resizeToSquareWebp(file);
  return await uploadBlob(blob, "products");
}

/**
 * Resize (center-crop) and upload an image at custom dimensions.
 * Used for banners, promo tiles, storefront banners, etc.
 */
export async function uploadImageAt(
  file: File,
  width: number,
  height: number,
  folder = "banners",
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Fichier non image");
  const blob = await resizeToWebp(file, width, height);
  return await uploadBlob(blob, folder);
}

async function uploadBlob(blob: Blob, folder: string): Promise<string> {
  const name = `${crypto.randomUUID()}.webp`;
  const path = `${folder}/${new Date().getFullYear()}/${name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
