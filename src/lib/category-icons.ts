import {
  ShieldCheck,
  GraduationCap,
  Wrench,
  Cpu,
  Download,
  Smartphone,
  Laptop,
  Headphones,
  Sparkles,
  Shirt,
  Apple,
  Home as HomeIcon,
  Baby,
  Dumbbell,
  Hammer,
  Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  telephones: Smartphone,
  ordinateurs: Laptop,
  audio: Headphones,
  securite: ShieldCheck,
  "installation-securite": Wrench,
  reparation: Wrench,
  "formations-pro": GraduationCap,
  "acces-saas": Download,
  "e-books": Download,
  logiciels: Cpu,
  "mode-chaussures": Shirt,
  "beaute-cheveux": Sparkles,
  alimentaire: Apple,
  "maison-entretien": HomeIcon,
  "bebe-enfant": Baby,
  "sport-loisirs": Dumbbell,
  "bricolage-outillage": Hammer,
};

export function iconForCategory(slug: string): LucideIcon {
  return CATEGORY_ICON[slug] ?? Package;
}
