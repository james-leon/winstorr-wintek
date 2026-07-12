import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type Role = "customer" | "staff" | "admin";

type AuthCtx = {
  user: User | null;
  roles: Role[];
  isStaff: boolean;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async (u: User | null) => {
      setUser(u);
      if (!u) {
        setRoles([]);
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id);
      if (error) {
        console.error("[auth] failed to load user_roles", error);
        setRoles([]);
        return;
      }
      const next = (data ?? []).map((r) => r.role as Role);
      console.debug("[auth] loaded roles for", u.id, next);
      setRoles(next);
    };

    supabase.auth.getUser().then(({ data }) => {
      load(data.user ?? null).finally(() => setLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        setLoading(true);
        load(session?.user ?? null).finally(() => setLoading(false));
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    user,
    roles,
    isStaff: roles.includes("staff") || roles.includes("admin"),
    isAdmin: roles.includes("admin"),
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
