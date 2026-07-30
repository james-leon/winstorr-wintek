import { createFileRoute } from "@tanstack/react-router";
import { useMyFinancingPartners } from "@/lib/financing";
import { FinancingRequestsTable, useFinancingRequests } from "@/components/financing-requests-table";

export const Route = createFileRoute("/_authenticated/partenaire/tableau-de-bord")({
  component: PartnerDashboard,
});

function PartnerDashboard() {
  const { data: memberships } = useMyFinancingPartners();
  const partnerId = memberships?.[0]?.financing_partner_id ?? null;
  const { data: rows = [] } = useFinancingRequests(partnerId, !!partnerId);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const thisMonth = rows.filter((r) => new Date(r.created_at) >= startOfMonth);

  const stats = [
    { label: "Demandes ce mois", value: thisMonth.length },
    { label: "Nouvelles", value: rows.filter((r) => r.status === "new").length },
    { label: "En cours", value: rows.filter((r) => r.status === "contacted" || r.status === "approved").length },
    { label: "Abouties", value: rows.filter((r) => r.status === "completed").length },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-2 text-lg font-bold text-foreground">{s.value}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 font-display text-xl text-foreground">Demandes de financement</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Ces demandes sont des mises en relation : le contrat, l'étude du dossier et l'encaissement se font hors
          Winstorr, selon vos procédures habituelles.
        </p>
        <FinancingRequestsTable rows={rows} invalidateKey={[partnerId]} />
      </div>
    </div>
  );
}
