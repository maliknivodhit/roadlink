import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";
import { toast } from "sonner";

export const Route = createFileRoute("/alerts")({ component: AlertsPage });

function AlertsPage() {
  const { data: m } = useMembership();
  const qc = useQueryClient();
  const cid = m?.profile?.company_id;
  const { data: alerts } = useQuery({
    queryKey: ["alerts", cid], enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from("alerts").select("*").eq("company_id", cid!).order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  async function ack(id: string) {
    await supabase.from("alerts").update({ acknowledged_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["alerts", cid] });
    toast.success("Acknowledged");
  }

  return (
    <AppShell>
      <PageHeader title="Alerts" subtitle="HOS violations, geofence breaches, device issues" />
      <div className="space-y-2 p-6">
        {(!alerts || alerts.length === 0) && (<Card className="p-12 text-center text-sm text-muted-foreground">No alerts.</Card>)}
        {alerts?.map((a) => (
          <Card key={a.id} className="flex items-start justify-between gap-4 p-4">
            <div className="flex items-start gap-3">
              <div className={`mt-1.5 dot ${a.severity === "critical" ? "bg-destructive" : a.severity === "warning" ? "bg-warning" : "bg-info"}`} />
              <div>
                <div className="flex items-center gap-2"><span className="font-medium">{a.title}</span><Badge variant="outline">{a.category}</Badge></div>
                {a.body && <div className="mt-1 text-sm text-muted-foreground">{a.body}</div>}
                <div className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
              </div>
            </div>
            {!a.acknowledged_at && <Button size="sm" variant="outline" onClick={() => ack(a.id)}>Acknowledge</Button>}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
