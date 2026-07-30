import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Undo2, Wrench, GraduationCap,
  Package, FolderTree, Star, Tag, Store, BarChart3, MapPin, Image, UserPlus,
  Menu, ChevronDown, CreditCard,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { AdminNotificationBell } from "@/components/admin-notification-bell";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };
type NavGroup = { label: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true }] },
  { label: "Commandes", items: [
    { to: "/admin/commandes", label: "Toutes les commandes", icon: ShoppingCart },
    { to: "/admin/retours", label: "Retours", icon: Undo2 },
    { to: "/admin/demandes", label: "Demandes service", icon: Wrench },
    { to: "/admin/sessions", label: "Sessions formation", icon: GraduationCap },
  ]},
  { label: "Produits", items: [
    { to: "/admin/produits", label: "Tous les produits", icon: Package },
    { to: "/admin/categories", label: "Catégories", icon: FolderTree },
    { to: "/admin/avis", label: "Avis", icon: Star },
  ]},
  { label: "Marketing", items: [
    { to: "/admin/codes-promo", label: "Codes promo", icon: Tag },
    { to: "/admin/banieres", label: "Bannières & tuiles", icon: Image },
  ]},
  { label: "Vendeurs", items: [
    { to: "/admin/vendeurs", label: "Tous les vendeurs", icon: Store },
    { to: "/admin/candidatures-vendeurs", label: "Candidatures", icon: UserPlus },
    { to: "/admin/commissions", label: "Commissions", icon: Tag },
    { to: "/admin/retraits", label: "Retraits", icon: BarChart3 },
    { to: "/admin/annonces-vendeurs", label: "Annonces", icon: Star },
    { to: "/admin/questions", label: "Questions produits", icon: FolderTree },
  ]},
  { label: "Financement", items: [
    { to: "/admin/financement", label: "Paiement échelonné", icon: CreditCard },
  ]},
  { label: "Analytique", items: [
    { to: "/admin/analytics", label: "Rapports", icon: BarChart3 },
  ]},
  { label: "Livraison", items: [
    { to: "/admin/points-retrait", label: "Points de retrait", icon: MapPin },
  ]},
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function isActive(itemTo: string, path: string, exact?: boolean) {
  if (exact) return path === itemTo;
  return path === itemTo || path.startsWith(itemTo + "/");
}

function SidebarNav({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 py-4">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className="px-2">
          {group.label && (
            <div className="mt-3 mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {group.label}
            </div>
          )}
          {group.items.map((item) => {
            const active = isActive(item.to, path, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm no-link-color transition-colors",
                  active
                    ? "bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium shadow-sm"
                    : "text-white/75 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function AdminLayout() {
  const { isStaff, loading, user, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    if (!loading && !isStaff) void nav({ to: "/" });
  }, [loading, isStaff, nav]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  if (!isStaff) return null;

  const current = ALL_ITEMS.find((i) => isActive(i.to, path, i.exact));
  const crumb = current?.label ?? "Administration";

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col bg-[#14161A] border-r border-black/20 shrink-0">
        <div className="border-b border-white/10 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 no-link-color text-white">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-orange-500 to-red-500 text-xs font-bold">W</div>
            <div>
              <div className="font-display text-sm leading-none">Winstorr</div>
              <div className="text-[10px] uppercase tracking-wider text-white/50">Admin</div>
            </div>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav path={path} />
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted md:hidden" aria-label="Menu">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-[#14161A] p-0 text-white">
                <div className="border-b border-white/10 px-4 py-3">
                  <div className="font-display text-sm">Winstorr Admin</div>
                </div>
                <div className="overflow-y-auto">
                  <SidebarNav path={path} onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <nav className="flex items-center gap-1.5 text-sm min-w-0" aria-label="Fil d'ariane">
              <Link to="/admin" className="text-muted-foreground no-link-color hover:text-foreground">Admin</Link>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium text-foreground truncate">{crumb}</span>
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <AdminNotificationBell />
            <div className="relative">
              <button
                onClick={() => setUserMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <div className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {(user?.email ?? "?").charAt(0).toUpperCase()}
                </div>
                <span className="hidden max-w-[140px] truncate sm:block">{user?.email}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {userMenu && (
                <div className="absolute right-0 top-11 z-50 w-48 rounded-md border border-border bg-card shadow-lg">
                  <Link to="/mon-compte" onClick={() => setUserMenu(false)} className="block px-3 py-2 text-sm no-link-color hover:bg-muted">Mon compte</Link>
                  <Link to="/" onClick={() => setUserMenu(false)} className="block px-3 py-2 text-sm no-link-color hover:bg-muted">Retour au site</Link>
                  <button onClick={() => { void signOut(); }} className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10">Déconnexion</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
