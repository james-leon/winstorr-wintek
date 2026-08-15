import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, Plus, RotateCw, Trash2, XCircle, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination, usePagination } from "@/components/pagination";
import { waTemplates } from "@/lib/whatsapp";
import {
  createVendorInvitation,
  revokeVendorInvitation,
  resendVendorInvitation,
  deleteVendorInvitation,
} from "@/lib/vendor-invitations.functions";
import { getVendorDeletionImpact, deleteVendor } from "@/lib/vendor-admin.functions";
import { SkeletonTableRows } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/admin/vendeurs")({
  component: AdminVendors,
});

function invitationUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://winstorr.com";
  return `${origin}/vendeur/invitation/${token}`;
}

function ShareRow({ token, expiresAt, vendorName }: { token: string; expiresAt: string; vendorName?: string | null }) {
  const { t } = useTranslation();
  const link = invitationUrl(token);
  const wa = `https://wa.me/?text=${encodeURIComponent(waTemplates.vendorInvitation({ link, expiresAt, vendorName }))}`;
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="outline"
        onClick={() => { void navigator.clipboard.writeText(link); toast.success(t("adminVendors.linkCopied")); }}>
        <Copy className="mr-1 h-3.5 w-3.5" /> {t("adminVendors.copyLink")}
      </Button>
      <Button size="sm" variant="outline"
        className="border-[#25D366]/40 text-[#128C7E] hover:bg-[#25D366]/10 hover:text-[#128C7E]"
        onClick={() => window.open(wa, "_blank", "noopener,noreferrer")}>
        <MessageCircle className="mr-1 h-3.5 w-3.5" /> {t("adminVendors.shareWhatsApp")}
      </Button>
    </div>
  );
}

function AdminVendors() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["admin-vendors-full"],
    queryFn: async () => {
      const [{ data: vs, error: e1 }, { data: mems, error: e2 }] = await Promise.all([
        supabase.from("vendors").select("id, name, slug, status, type, contact_email, created_at, city, verified, sales_count").order("name"),
        supabase.from("vendor_members").select("vendor_id"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const counts = new Map<string, number>();
      for (const m of mems ?? []) counts.set(m.vendor_id, (counts.get(m.vendor_id) ?? 0) + 1);
      return (vs ?? []).map((v) => ({ ...v, members: counts.get(v.id) ?? 0 }));
    },
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["admin-vendor-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_invitations")
        .select("id, email, proposed_vendor_name, vendor_id, token, status, expires_at, created_at, revoked_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const vendorNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vendors) m.set(v.id, v.name);
    return m;
  }, [vendors]);

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "revoked" | "expired">("all");
  const filteredInvitations = useMemo(() => {
    if (statusFilter === "all") return invitations;
    return invitations.filter((i) => i.status === statusFilter);
  }, [invitations, statusFilter]);

  const vendorsPg = usePagination(vendors, 25);
  const invitationsPg = usePagination(filteredInvitations, 25);

  const suspend = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "suspended" }) => {
      const { error } = await supabase.from("vendors").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("adminVendors.vendorUpdated")); qc.invalidateQueries({ queryKey: ["admin-vendors-full"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTrust = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { city?: string | null; verified?: boolean } }) => {
      const { error } = await supabase.from("vendors").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("adminVendors.vendorUpdated")); qc.invalidateQueries({ queryKey: ["admin-vendors-full"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidateInv = () => qc.invalidateQueries({ queryKey: ["admin-vendor-invitations"] });

  const revokeFn = useServerFn(revokeVendorInvitation);
  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => { toast.success(t("adminVendors.invitationRevoked")); invalidateInv(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendFn = useServerFn(resendVendorInvitation);
  const resend = useMutation({
    mutationFn: (id: string) => resendFn({ data: { id } }),
    onSuccess: () => { toast.success(t("adminVendors.linkRegenerated")); invalidateInv(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFn = useServerFn(deleteVendorInvitation);
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success(t("adminVendors.invitationDeleted")); invalidateInv(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("adminVendors.vendors")}</h2>
          <Button onClick={() => setInviteOpen(true)}><Plus className="mr-1 h-4 w-4" /> {t("adminVendors.inviteVendor")}</Button>
        </div>
        <div className="rounded-sm border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">{t("adminVendors.name")}</th><th className="p-3">{t("adminVendors.type")}</th>
                <th className="p-3">{t("adminVendors.members")}</th><th className="p-3">{t("trust.trustProfile")}</th><th className="p-3">{t("adminVendors.status")}</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <SkeletonTableRows rows={6} cols={6} />}
              {vendorsPg.paged.map((v) => (
                <tr key={v.id}>
                  <td className="p-3 font-medium">{v.name}<div className="text-xs text-muted-foreground">{v.slug}{v.contact_email && ` · ${v.contact_email}`}</div></td>
                  <td className="p-3 text-xs">{v.type === "internal" ? t("adminVendors.official") : t("adminVendors.external")}</td>
                  <td className="p-3 text-xs">{v.members}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1.5">
                      <input
                        defaultValue={v.city ?? ""}
                        placeholder="Ville"
                        className="h-8 w-32 rounded-sm border border-border bg-background px-2 text-xs"
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (v.city ?? "")) updateTrust.mutate({ id: v.id, patch: { city: val || null } });
                        }}
                      />
                      <input
                        defaultValue={v.verification_note ?? ""}
                        placeholder={t("trust.verificationNotePlaceholder")}
                        title={t("trust.verificationNote")}
                        className="h-8 w-44 rounded-sm border border-border bg-background px-2 text-xs"
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (v.verification_note ?? "")) updateTrust.mutate({ id: v.id, patch: { verification_note: val || null } });
                        }}
                      />
                      <Button
                        size="sm"
                        variant={v.verified ? "default" : "outline"}
                        className="h-7 px-2 text-[11px]"
                        onClick={() => updateTrust.mutate({ id: v.id, patch: { verified: !v.verified } })}
                      >
                        {v.verified ? t("trust.removeVerification") : t("trust.markVerified")}
                      </Button>
                      {v.verified && <SellerVerifiedBadge />}
                      <span className="text-[11px] text-muted-foreground">
                        {Number(v.sales_count ?? 0) > 0 ? t("trust.sales", { count: Number(v.sales_count) }) : t("trust.noSalesYet")}
                      </span>

                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${v.status === "active" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {v.type !== "internal" && (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" variant="outline"
                          onClick={() => suspend.mutate({ id: v.id, status: v.status === "active" ? "suspended" : "active" })}>
                          {v.status === "active" ? t("adminVendors.suspend") : t("adminVendors.reactivate")}
                        </Button>
                        <Button size="sm" variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ id: v.id, name: v.name })}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> {t("adminVendors.delete")}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t("adminVendors.noVendors")}</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={vendorsPg.page} pageCount={vendorsPg.pageCount} total={vendorsPg.total} rangeStart={vendorsPg.rangeStart} rangeEnd={vendorsPg.rangeEnd} onPageChange={vendorsPg.setPage} label={t("adminVendors.vendorsLabel")} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("adminVendors.invitations")}</h2>
            <p className="text-xs text-muted-foreground">{t("adminVendors.manualHint")}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("adminVendors.filter")}</span>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("adminVendors.filterAll")}</SelectItem>
                <SelectItem value="pending">{t("adminVendors.filterPending")}</SelectItem>
                <SelectItem value="accepted">{t("adminVendors.filterAccepted")}</SelectItem>
                <SelectItem value="revoked">{t("adminVendors.filterRevoked")}</SelectItem>
                <SelectItem value="expired">{t("adminVendors.filterExpired")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-sm border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">{t("adminVendors.email")}</th>
                <th className="p-3">{t("adminVendors.vendor")}</th>
                <th className="p-3">{t("adminVendors.status")}</th>
                <th className="p-3">{t("adminVendors.created")}</th>
                <th className="p-3">{t("adminVendors.expires")}</th>
                <th className="p-3 text-right">{t("adminVendors.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invitationsPg.paged.map((i) => {
                const expiredByDate = new Date(i.expires_at) < new Date();
                const effectiveStatus = i.status === "pending" && expiredByDate ? "expired" : i.status;
                const isPending = i.status === "pending" && !expiredByDate;
                const isAccepted = i.status === "accepted";
                const canDelete = i.status === "revoked" || i.status === "expired" || (i.status === "pending" && expiredByDate);
                const vendorLabel = i.vendor_id
                  ? (vendorNameById.get(i.vendor_id) ?? "—")
                  : (i.proposed_vendor_name ?? "—");
                return (
                  <tr key={i.id} className="align-top">
                    <td className="p-3">
                      <div className="font-medium">{i.email}</div>
                    </td>
                    <td className="p-3 text-xs">
                      {isAccepted && i.vendor_id ? (
                        <Link to="/admin/vendeurs" className="text-primary underline-offset-2 hover:underline">
                          {vendorLabel}
                        </Link>
                      ) : vendorLabel}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        effectiveStatus === "pending" ? "bg-accent/10 text-accent"
                        : effectiveStatus === "accepted" ? "bg-success/15 text-success"
                        : effectiveStatus === "revoked" ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                      }`}>
                        {effectiveStatus}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(i.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3 text-xs">{new Date(i.expires_at).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {isPending && (
                          <>
                            <ShareRow token={i.token} expiresAt={i.expires_at} vendorName={vendorLabel === "—" ? null : vendorLabel} />
                            <Button size="sm" variant="outline" disabled={resend.isPending}
                              title={t("adminVendors.regenerateHint")}
                              onClick={() => resend.mutate(i.id)}>
                              <RotateCw className="mr-1 h-3.5 w-3.5" /> {t("adminVendors.regenerate")}
                            </Button>
                            <ConfirmDialog
                              trigger={<Button size="sm" variant="outline"><XCircle className="mr-1 h-3.5 w-3.5" /> {t("adminVendors.revoke")}</Button>}
                              title={t("adminVendors.revokeTitle")}
                              description={t("adminVendors.revokeDesc", { email: i.email })}
                              confirmLabel={t("adminVendors.revoke")}
                              onConfirm={() => revoke.mutate(i.id)}
                            />
                          </>
                        )}
                        {effectiveStatus === "expired" && (
                          <Button size="sm" variant="outline" disabled={resend.isPending}
                            onClick={() => resend.mutate(i.id)}>
                            <RotateCw className="mr-1 h-3.5 w-3.5" /> {t("adminVendors.reactivateInvite")}
                          </Button>
                        )}
                        {isAccepted && (
                          <span className="text-xs text-muted-foreground">{t("adminVendors.readOnly")}</span>
                        )}
                        {canDelete && (
                          <ConfirmDialog
                            trigger={
                              <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10">
                                <Trash2 className="mr-1 h-3.5 w-3.5" /> {t("adminVendors.delete")}
                              </Button>
                            }
                            title={t("adminVendors.deleteInviteTitle")}
                            description={t("adminVendors.deleteInviteDesc", { email: i.email })}
                            confirmLabel={t("adminVendors.delete")}
                            onConfirm={() => del.mutate(i.id)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredInvitations.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t("adminVendors.noInvitations")}</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={invitationsPg.page} pageCount={invitationsPg.pageCount} total={invitationsPg.total} rangeStart={invitationsPg.rangeStart} rangeEnd={invitationsPg.rangeEnd} onPageChange={invitationsPg.setPage} label={t("adminVendors.invitationsLabel")} />
      </section>

      {inviteOpen && (
        <InviteDialog
          existingVendors={vendors.filter((v) => v.type === "external")}
          onClose={() => setInviteOpen(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["admin-vendor-invitations"] })}
        />
      )}

      {deleteTarget && (
        <DeleteVendorDialog
          vendor={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            qc.invalidateQueries({ queryKey: ["admin-vendors-full"] });
            qc.invalidateQueries({ queryKey: ["admin-vendor-invitations"] });
          }}
        />
      )}
    </div>
  );
}

function DeleteVendorDialog({ vendor, onClose, onDeleted }: {
  vendor: { id: string; name: string }; onClose: () => void; onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const impactFn = useServerFn(getVendorDeletionImpact);
  const deleteVendorFn = useServerFn(deleteVendor);

  const { data: impact, isLoading, error } = useQuery({
    queryKey: ["vendor-deletion-impact", vendor.id],
    queryFn: () => impactFn({ data: { vendor_id: vendor.id } }),
  });

  const mut = useMutation({
    mutationFn: () => deleteVendorFn({ data: { vendor_id: vendor.id } }),
    onSuccess: () => { toast.success(t("adminVendors.vendorDeleted")); onDeleted(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const blocked = impact?.blocked ?? false;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("adminVendors.deleteVendorTitle", { name: vendor.name })}</DialogTitle></DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {impact && (
          <div className="space-y-3 text-sm">
            {blocked ? (
              <div className="space-y-1 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                {(impact.blockers ?? []).map((b) => <p key={b}>{b}</p>)}
              </div>
            ) : (
              <p className="text-muted-foreground">{t("adminVendors.deleteWarning")}</p>
            )}
            <ul className="list-disc space-y-1 pl-5">
              <li>{t("adminVendors.countProducts", { count: impact.products })}</li>
              <li>{t("adminVendors.countFollowers", { count: impact.followers })}</li>
              <li>{t("adminVendors.countWithdrawals", { count: impact.withdrawals })}</li>
              <li>{t("adminVendors.countCommissions", { count: impact.commissionRules })}</li>
              <li>{t("adminVendors.countMembers", { count: impact.members })}</li>
              <li>{t("adminVendors.countInvitations", { count: impact.invitations })}</li>
            </ul>

          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            type="button"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={blocked || isLoading || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? "..." : t("adminVendors.deletePermanently")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({ existingVendors, onClose, onCreated }: {
  existingVendors: { id: string; name: string }[]; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [created, setCreated] = useState<{ token: string; expires_at: string } | null>(null);

  const createFn = useServerFn(createVendorInvitation);
  const mut = useMutation({
    mutationFn: () => createFn({ data: {
      email,
      proposed_vendor_name: mode === "new" ? name : null,
      vendor_id: mode === "existing" ? vendorId : null,
    } }),
    onSuccess: (res) => {
      toast.success(t("adminVendors.invitationCreated"));
      setCreated({ token: res.token, expires_at: res.expires_at });
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vendorName = mode === "new" ? name : (existingVendors.find((v) => v.id === vendorId)?.name ?? null);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("adminVendors.inviteVendor")}</DialogTitle></DialogHeader>
        {created ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("adminVendors.shareInstructions")}</p>
            <div className="rounded-sm border border-border bg-muted/40 p-2 text-xs break-all">
              {invitationUrl(created.token)}
            </div>
            <ShareRow token={created.token} expiresAt={created.expires_at} vendorName={vendorName} />
            <p className="text-xs text-muted-foreground">
              {t("adminVendors.expiresOn", { date: new Date(created.expires_at).toLocaleDateString("fr-FR") })}
            </p>
            <DialogFooter>
              <Button type="button" onClick={onClose}>{t("common.close")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
            <div><Label>{t("adminVendors.email")} *</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div>
              <Label>{t("adminVendors.type")}</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "new" | "existing")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">{t("adminVendors.modeNew")}</SelectItem>
                  <SelectItem value="existing" disabled={existingVendors.length === 0}>{t("adminVendors.modeExisting")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "new" ? (
              <div><Label>{t("adminVendors.proposedName")} *</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Techno Cameroun" /></div>
            ) : (
              <div>
                <Label>{t("adminVendors.existingVendor")} *</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger><SelectValue placeholder={t("adminVendors.choose")} /></SelectTrigger>
                  <SelectContent>
                    {existingVendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "..." : t("adminVendors.generateLink")}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
