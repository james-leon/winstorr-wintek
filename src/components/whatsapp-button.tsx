import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildWaLink } from "@/lib/whatsapp";
import { toast } from "sonner";

type Props = {
  phone: string | null | undefined;
  message: string;
  label?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  disabled?: boolean;
};

/**
 * Manual WhatsApp send — opens wa.me in a new tab pre-filled with `message`.
 * The sender can still edit the text in WhatsApp before hitting Send.
 */
export function WhatsAppButton({
  phone,
  message,
  label = "WhatsApp",
  size = "sm",
  variant = "outline",
  className,
  disabled,
}: Props) {
  const href = buildWaLink(phone, message);
  const isDisabled = disabled || !href;
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={isDisabled}
      className={cn(
        "gap-1.5 border-[#25D366]/40 text-[#128C7E] hover:bg-[#25D366]/10 hover:text-[#128C7E]",
        className,
      )}
      onClick={() => {
        if (!href) {
          toast.error("Numéro de téléphone manquant ou invalide.");
          return;
        }
        window.open(href, "_blank", "noopener,noreferrer");
      }}
      title={href ? "Ouvre WhatsApp avec le message pré-rempli" : "Numéro indisponible"}
    >
      <MessageCircle className="h-4 w-4" />
      {label}
    </Button>
  );
}
