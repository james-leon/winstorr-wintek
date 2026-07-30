import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatFcfa } from "@/lib/format";
import { buildWaLink } from "@/lib/whatsapp";
import { estimateMonthly, FINANCING_EXAMPLE_MONTHS, useActiveFinancingPartner } from "@/lib/financing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Props = {
  productId: string;
  productName: string;
  variantId?: string | null;
  vendorId?: string | null;
  vendorAllowsFinancing: boolean;
  price: number | null;
};

export function FinancingOffer({ productId, productName, variantId, vendorId, vendorAllowsFinancing, price }: Props) {
  const { data: partner } = useActiveFinancingPartner();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const eligible =
    !!partner && vendorAllowsFinancing && price != null && Number(price) >= Number(partner.min_product_price);

  const submit = useMutation({
    mutationFn: async () => {
      if (!partner) throw new Error("Aucun partenaire financier disponible.");
      if (name.trim().length < 2) throw new Error("Merci d'indiquer votre nom.");
      if (phone.replace(/\D/g, "").length < 8) throw new Error("Merci d'indiquer un numéro de téléphone valide.");
      const { error } = await supabase.from("financing_requests").insert({
        product_id: productId,
        variant_id: variantId ?? null,
        financing_partner_id: partner.id,
        vendor_id: vendorId ?? null,
        product_name: productName,
        product_price: Number(price ?? 0),
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim() || null,
        customer_message: message.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => setDone(true),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!eligible || !partner) return null;

  const monthly = estimateMonthly(Number(price));
  const wa = buildWaLink(
    partner.contact_phone,
    `Bonjour ${partner.name}, je souhaite un paiement échelonné pour "${productName}" (${formatFcfa(Number(price))}) sur Winstorr.`,
  );

  return (
    <>
      <div className="mt-3 rounded-sm border border-accent/30 bg-accent/5 p-3">
        <div className="flex items-start gap-2">
          <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">
              Paiement en plusieurs fois disponible avec {partner.name}
            </div>
            <div className="mt-0.5 text-[13px] text-muted-foreground">
              À partir de ~<span className="font-semibold text-foreground">{formatFcfa(monthly)}</span>/mois sur{" "}
              {FINANCING_EXAMPLE_MONTHS} mois — <span className="italic">estimation, selon dossier</span>.
            </div>
            {partner.default_terms_description && (
              <div className="mt-1 text-[11px] text-muted-foreground">{partner.default_terms_description}</div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground"
              onClick={() => { setDone(false); setOpen(true); }}
            >
              Demander le paiement échelonné
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {done ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <DialogHeader>
                <DialogTitle className="text-center">Demande transmise</DialogTitle>
                <DialogDescription className="text-center">
                  Votre demande a été transmise à {partner.name}. Ils vous contacteront sous peu au {phone} pour
                  finaliser les modalités. Aucune commande n'a été passée sur Winstorr.
                </DialogDescription>
              </DialogHeader>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="no-link-color block">
                  <Button variant="outline" className="w-full">Contacter {partner.name} sur WhatsApp</Button>
                </a>
              )}
              <Button className="w-full" onClick={() => setOpen(false)}>Fermer</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Demande de paiement échelonné</DialogTitle>
                <DialogDescription>
                  Ceci n'est pas un achat : votre demande est transmise à {partner.name}, notre partenaire financier,
                  qui vous contactera pour étudier votre dossier et fixer les mensualités.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-sm border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                  {productName} — <span className="font-medium text-foreground">{formatFcfa(Number(price))}</span>
                </div>
                <div>
                  <Label>Nom complet *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                </div>
                <div>
                  <Label>Téléphone *</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6…" maxLength={30} />
                </div>
                <div>
                  <Label>Email (optionnel)</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
                </div>
                <div>
                  <Label>Message (optionnel)</Label>
                  <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
                </div>
                <Button className="w-full" disabled={submit.isPending} onClick={() => submit.mutate()}>
                  {submit.isPending ? "Envoi…" : "Envoyer ma demande"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
