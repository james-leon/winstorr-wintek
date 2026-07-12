import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  related_order_id: string | null;
  related_return_id: string | null;
  created_at: string;
};

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("admin_notifications")
        .select("id, type, message, read, related_order_id, related_return_id, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (mounted) setItems(data ?? []);
    };
    void load();
    const channel = supabase
      .channel("admin_notifications_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (p) => setItems((prev) => [p.new as Notif, ...prev].slice(0, 30)),
      )
      .subscribe();
    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const unread = items.filter((i) => !i.read).length;

  const markAll = async () => {
    const ids = items.filter((i) => !i.read).map((i) => i.id);
    if (ids.length === 0) return;
    await supabase.from("admin_notifications").update({ read: true }).in("id", ids);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  };

  const targetPath = (n: Notif) => (n.type === "return_requested" ? "/admin/retours" : "/admin/commandes");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-9 w-9 place-items-center rounded-sm hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-sm border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border p-2">
            <span className="text-sm font-semibold">Notifications</span>
            <button onClick={markAll} className="inline-flex items-center gap-1 text-xs text-secondary hover:underline">
              <CheckCheck className="h-3.5 w-3.5" /> Tout marquer lu
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {items.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">Rien pour l'instant.</div>
            )}
            {items.map((n) => (
              <Link
                key={n.id}
                to={targetPath(n)}
                onClick={() => setOpen(false)}
                className={cn(
                  "block p-2.5 no-link-color hover:bg-muted",
                  !n.read && "bg-accent/5",
                )}
              >
                <div className="text-sm text-foreground">{n.message}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("fr-FR")}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
