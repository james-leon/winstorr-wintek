import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ChevronRight, ChevronLeft, TrendingUp, Sparkles, ShieldCheck, User as UserIcon, Package, Heart, Store, LogOut, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/format";
import logo from "@/assets/winstorr-logo.png.asset.json";

type Category = {
  id: string;
  name: string;
  slug: string;
  product_type: ProductType;
  parent_id: string | null;
};

const TYPE_LABEL: Record<ProductType, string> = {
  physical: "Produits physiques",
  digital: "Numérique",
  service: "Services",
  training: "Formations",
};

export function NavigationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut, isStaff } = useAuth();
  const [drillTypeOrId, setDrillTypeOrId] = useState<
    | { kind: "type"; type: ProductType }
    | { kind: "category"; id: string; name: string }
    | null
  >(null);

  const firstName = user?.user_metadata?.name?.split(" ")?.[0] || user?.email?.split("@")?.[0];

  const { data: categories = [] } = useQuery({
    queryKey: ["drawer-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id,name,slug,product_type,parent_id,status,display_order")
        .eq("status", "active")
        .order("display_order", { ascending: true });
      return (data ?? []) as (Category & { status: string; display_order: number })[];
    },
    staleTime: 5 * 60_000,
  });

  const topLevel = categories.filter((c) => c.parent_id === null);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId);

  // Group top-level cats by product type; also list all product types
  const typesInUse: ProductType[] = ["physical", "digital", "service", "training"];

  useEffect(() => {
    if (!open) setDrillTypeOrId(null);
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const close = () => { onClose(); };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      )}
      aria-hidden={!open}
    >
      {/* Overlay */}
      <button
        aria-label="Fermer le menu"
        onClick={close}
        className="absolute inset-0 bg-black/55"
      />

      {/* Panel */}
      <aside
        className={cn(
          "absolute left-0 top-0 h-full w-[min(88vw,400px)] bg-background text-foreground shadow-2xl",
          "transition-transform duration-200 ease-out flex flex-col",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        role="dialog"
        aria-label="Menu principal"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 text-white"
          style={{ background: "var(--color-header)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <UserIcon className="h-5 w-5 shrink-0" />
            <span className="truncate text-base font-semibold">
              {user ? `Bonjour, ${firstName}` : "Bonjour, Identifiez-vous"}
            </span>
          </div>
          <button
            onClick={close}
            aria-label="Fermer"
            className="grid h-8 w-8 place-items-center rounded-sm hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {drillTypeOrId === null && (
            <>
              {/* Tendances */}
              <Section title="Tendances">
                <DrawerLink to="/catalogue" onClick={close} icon={<TrendingUp className="h-4 w-4" />} label="Meilleures ventes" />
                <DrawerLink to="/catalogue" onClick={close} icon={<Sparkles className="h-4 w-4" />} label="Dernières nouveautés" />
                <DrawerLink to="/catalogue" onClick={close} icon={<ShieldCheck className="h-4 w-4" />} label="Qualité vérifiée" />
              </Section>

              {/* Catégories — drill down by type first, then real categories */}
              <Section title="Catégories">
                {typesInUse.map((t) => (
                  <button
                    key={t}
                    onClick={() => setDrillTypeOrId({ kind: "type", type: t })}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-muted"
                  >
                    <span>{TYPE_LABEL[t]}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </Section>

              {/* Compte */}
              <Section title="Compte">
                {user ? (
                  <>
                    <DrawerLink to="/mon-compte" onClick={close} icon={<UserIcon className="h-4 w-4" />} label="Mon compte" />
                    <DrawerLink to="/mon-compte/commandes" onClick={close} icon={<Package className="h-4 w-4" />} label="Mes commandes" />
                    <DrawerLink to="/mon-compte/souhaits" onClick={close} icon={<Heart className="h-4 w-4" />} label="Ma liste de souhaits" />
                    <DrawerLink to="/boutiques" onClick={close} icon={<Store className="h-4 w-4" />} label="Nos boutiques" />
                    {isStaff && <DrawerLink to="/admin/produits" onClick={close} icon={<Store className="h-4 w-4" />} label="Admin" />}
                    <button
                      onClick={() => { close(); void signOut(); }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted"
                    >
                      <LogOut className="h-4 w-4" /> Se déconnecter
                    </button>
                  </>
                ) : (
                  <>
                    <DrawerLink to="/auth" onClick={close} icon={<LogIn className="h-4 w-4" />} label="Se connecter / S'inscrire" />
                    <DrawerLink to="/boutiques" onClick={close} icon={<Store className="h-4 w-4" />} label="Nos boutiques" />
                  </>
                )}
              </Section>
            </>
          )}

          {drillTypeOrId?.kind === "type" && (
            <>
              <DrillHeader
                title={TYPE_LABEL[drillTypeOrId.type]}
                onBack={() => setDrillTypeOrId(null)}
              />
              <div className="py-2">
                <Link
                  to="/catalogue"
                  search={{ type: drillTypeOrId.type } as never}
                  onClick={close}
                  className="flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted no-link-color"
                >
                  Voir tout — {TYPE_LABEL[drillTypeOrId.type]}
                </Link>
                {topLevel
                  .filter((c) => c.product_type === drillTypeOrId.type)
                  .map((c) => {
                    const kids = childrenOf(c.id);
                    if (kids.length > 0) {
                      return (
                        <button
                          key={c.id}
                          onClick={() => setDrillTypeOrId({ kind: "category", id: c.id, name: c.name })}
                          className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-muted"
                        >
                          <span>{c.name}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      );
                    }
                    return (
                      <Link
                        key={c.id}
                        to="/catalogue"
                        search={{ type: c.product_type, category: c.slug } as never}
                        onClick={close}
                        className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted no-link-color"
                      >
                        {c.name}
                      </Link>
                    );
                  })}
              </div>
            </>
          )}

          {drillTypeOrId?.kind === "category" && (() => {
            const parent = categories.find((c) => c.id === drillTypeOrId.id);
            const kids = childrenOf(drillTypeOrId.id);
            return (
              <>
                <DrillHeader
                  title={drillTypeOrId.name}
                  onBack={() => parent ? setDrillTypeOrId({ kind: "type", type: parent.product_type }) : setDrillTypeOrId(null)}
                />
                <div className="py-2">
                  {parent && (
                    <Link
                      to="/catalogue"
                      search={{ type: parent.product_type, category: parent.slug } as never}
                      onClick={close}
                      className="flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted no-link-color"
                    >
                      Voir tout — {parent.name}
                    </Link>
                  )}
                  {kids.map((c) => (
                    <Link
                      key={c.id}
                      to="/catalogue"
                      search={{ type: c.product_type, category: c.slug } as never}
                      onClick={close}
                      className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted no-link-color"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        {/* Footer brand */}
        <div className="border-t border-border px-4 py-3">
          <Link to="/" onClick={close} className="flex items-center gap-2 no-link-color">
            <img src={logo.url} alt="Winstorr" className="h-7 w-auto" />
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-2 border-b border-border">
      <div className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function DrawerLink({ to, onClick, icon, label }: { to: string; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted no-link-color">
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function DrillHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-2 py-2">
      <button
        onClick={onBack}
        aria-label="Retour"
        className="grid h-8 w-8 place-items-center rounded-sm hover:bg-muted"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}
