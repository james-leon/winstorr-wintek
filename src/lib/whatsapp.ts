// WhatsApp helpers — manual send via wa.me links (no WhatsApp Business API).
// Message templates are pre-filled but editable by the sender before dispatch.

/**
 * Normalize a Cameroonian phone number to international format (237...) with no
 * leading + or spaces, suitable for wa.me links.
 * - Strips non-digit characters.
 * - Assumes CM country code (237) when missing.
 * - Leaves other international prefixes intact if the number is longer than 9 digits
 *   and doesn't obviously look like a local CM number.
 */
export function normalizePhoneCM(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D+/g, "");
  if (!digits) return null;
  // Common local formats: 6XXXXXXXX (9 digits) — prepend 237.
  if (digits.length === 9 && /^[26]/.test(digits)) digits = "237" + digits;
  // If it already begins with 237 or another country code (11-15 digits), keep as-is.
  return digits;
}

export function buildWaLink(phone: string | null | undefined, message: string): string | null {
  const norm = normalizePhoneCM(phone);
  if (!norm) return null;
  return `https://wa.me/${norm}?text=${encodeURIComponent(message)}`;
}

// ------- Message templates -------

type PickupPoint = {
  name: string;
  address?: string | null;
  city?: string | null;
  contact_phone?: string | null;
  opening_hours?: string | null;
};

function fmtFcfa(v: number | string): string {
  return `${Number(v).toLocaleString("fr-FR")} FCFA`;
}

function pickupLine(pp?: PickupPoint | null): string {
  if (!pp) return "";
  const parts: string[] = [pp.name];
  if (pp.address) parts.push(pp.address);
  if (pp.city) parts.push(pp.city);
  const line = parts.join(", ");
  return pp.opening_hours ? `${line} (${pp.opening_hours})` : line;
}

export const waTemplates = {
  orderConfirmation(o: {
    customer_name: string;
    order_number: string;
    total: number | string;
    pickup?: PickupPoint | null;
    items?: { name: string; quantity: number }[];
  }): string {
    const first = o.customer_name.split(" ")[0];
    const itemsLine = o.items?.length
      ? `\nArticles : ${o.items.slice(0, 3).map((it) => `${it.name} × ${it.quantity}`).join(", ")}${o.items.length > 3 ? "…" : ""}`
      : "";
    const pp = pickupLine(o.pickup);
    const pickupBlock = pp ? `\nRetrait : ${pp}` : "";
    return `Bonjour ${first}, votre commande ${o.order_number} sur Winstorr est confirmée ✅.\nMontant : ${fmtFcfa(o.total)}${itemsLine}${pickupBlock}\n\nMerci de votre confiance !\nhttps://winstorr.com/commande/${o.order_number}/confirmation`;
  },

  readyForPickup(o: {
    customer_name: string;
    order_number: string;
    pickup?: PickupPoint | null;
  }): string {
    const first = o.customer_name.split(" ")[0];
    const pp = pickupLine(o.pickup);
    return `Bonjour ${first}, votre commande ${o.order_number} sur Winstorr est prête au retrait 📦.${pp ? `\nPoint : ${pp}` : ""}\n\nPensez à votre pièce d'identité et au numéro de commande. À très vite !`;
  },

  vendorContact(o: {
    customer_name: string;
    order_number: string;
    shipment_number?: string | null;
  }): string {
    const first = o.customer_name.split(" ")[0];
    return `Bonjour ${first}, je vous contacte au sujet de votre commande Winstorr ${o.order_number}${o.shipment_number ? ` (expédition ${o.shipment_number})` : ""}. Je suis le vendeur en charge de votre article — pouvez-vous confirmer un créneau pour la préparation ?`;
  },

  customerToSupport(o: {
    order_number: string;
  }): string {
    return `Bonjour Winstorr,\nJ'ai besoin d'aide au sujet de ma commande ${o.order_number}.`;
  },
};
