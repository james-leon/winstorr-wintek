/**
 * Rewrite a Supabase Storage public URL to use the on-the-fly image
 * transformer at the requested width. Keeps non-Supabase URLs untouched.
 */
export function imageAtWidth(url: string | null | undefined, width: number): string {
  if (!url) return "";
  if (!url.includes("/storage/v1/object/public/")) return url;
  const rendered = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  const sep = rendered.includes("?") ? "&" : "?";
  return `${rendered}${sep}width=${width}&resize=cover&quality=75`;
}

/**
 * Build a srcset string for an image at multiple widths.
 */
export function imageSrcSet(url: string | null | undefined, widths: number[]): string {
  if (!url) return "";
  return widths.map((w) => `${imageAtWidth(url, w)} ${w}w`).join(", ");
}
