import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";

export const Route = createFileRoute("/ifta")({ component: IftaPage });

function IftaPage() {
  const { data: m } = useMembership();
  const cid = m?.profile?.company_id;
  const { data } = useQuery({
    queryKey: ["ifta-summary", cid], enabled: !!cid,
    queryFn: async () => {
      const [{ data: fuel }, { data: miles }] = await Promise.all([
        supabase.from("ifta_fuel_purchases").select("jurisdiction,gallons,total_amount").eq("company_id", cid!),
        supabase.from("ifta_trip_miles").select("jurisdiction,miles").eq("company_id", cid!),
      ]);
      const byJ: Record<string, { jurisdiction: string; gallons: number; amount: number; miles: number }> = {};
      (fuel ?? []).forEach((f) => {
        const k = f.jurisdiction;
        byJ[k] ||= { jurisdiction: k, gallons: 0, amount: 0, miles: 0 };
        byJ[k].gallons += Number(f.gallons || 0);
        byJ[k].amount += Number(f.total_amount || 0);
      });
      (miles ?? []).forEach((mi) => {
        const k = mi.jurisdiction;
        byJ[k] ||= { jurisdiction: k, gallons: 0, amount: 0, miles: 0 };
        byJ[k].miles += Number(mi.miles || 0);
      });
      return Object.values(byJ).sort((a, b) => b.miles - a.miles);
    },
  });
  return (
    <AppShell>
      <PageHeader title="IFTA Reporting" subtitle="Fuel purchases and jurisdictional miles" />
      <div className="p-6">
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">Jurisdiction</th><th className="p-3">Miles</th><th className="p-3">Gallons</th><th className="p-3">Fuel $</th><th className="p-3">MPG</th></tr>
            </thead>
            <tbody>
              {(!data || data.length === 0) && (<tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No IFTA data yet.</td></tr>)}
              {data?.map((r) => (
                <tr key={r.jurisdiction} className="border-b border-border/60">
                  <td className="p-3 font-medium">{r.jurisdiction}</td>
                  <td className="p-3 num">{r.miles.toLocaleString()}</td>
                  <td className="p-3 num">{r.gallons.toFixed(2)}</td>
                  <td className="p-3 num">${r.amount.toFixed(2)}</td>
                  <td className="p-3 num">{r.gallons > 0 ? (r.miles / r.gallons).toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
