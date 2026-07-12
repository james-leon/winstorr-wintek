export function formatFcfa(value: number | null | undefined): string {
  if (value == null) return "";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value)) + " FCFA";
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type ProductType = "physical" | "digital" | "service" | "training";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  physical: "Produits physiques",
  digital: "Produit numérique",
  service: "Service",
  training: "Formation",
};

export function displayPrice(p: {
  price: number | null;
  price_type: "fixed" | "starting_at" | "quote_only";
}): string {
  if (p.price_type === "quote_only") return "Sur devis";
  if (p.price == null) return "Prix à confirmer";
  if (p.price_type === "starting_at") return "À partir de " + formatFcfa(p.price);
  return formatFcfa(p.price);
}
