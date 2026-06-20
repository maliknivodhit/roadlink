import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/AppShell";
import { LiveMap, type MapVehicle } from "@/components/LiveMap";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Users, AlertTriangle, Activity, ShieldCheck, Clock } from "lucide-react";
import { useMembership } from "@/hooks/useMembership";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

function Kpi({ label, value, sub, icon: Icon, tone = "default" }: { label: string; value: string | number; sub?: string; icon: any; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-destructive" : "text-primary";
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${toneCls}`} />
      </div>
      <div className="mt-2 num text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function Dashboard() {
  const { data: m } = useMembership();
  const companyId = m?.profile?.company_id;

  const { data: counts } = useQuery({
    queryKey: ["dashboard-counts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [drivers, vehicles, alerts, dvirOpen] = await Promise.all([
        supabase.from("drivers").select("id", { count: "exact", head: true }).eq("company_id", companyId!),
        supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("company_id", companyId!),
        supabase.from("alerts").select("id", { count: "exact", head: true }).eq("company_id", companyId!).is("resolved_at", null),
        supabase.from("dvir_defects").select("id", { count: "exact", head: true }).eq("company_id", companyId!).eq("status", "open"),
      ]);
      return {
        drivers: drivers.count ?? 0,
        vehicles: vehicles.count ?? 0,
        alerts: alerts.count ?? 0,
        defects: dvirOpen.count ?? 0,
      };
    },
  });

  const { data: gps } = useQuery({
    queryKey: ["dashboard-gps", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("gps_pings")
        .select("vehicle_id,latitude,longitude,recorded_at")
        .eq("company_id", companyId!)
        .order("recorded_at", { ascending: false })
        .limit(200);
      const seen = new Map<string, MapVehicle>();
      (data ?? []).forEach((p, i) => {
        if (!seen.has(p.vehicle_id)) seen.set(p.vehicle_id, {
          id: p.vehicle_id, unit: String(i + 1),
          lat: Number(p.latitude), lng: Number(p.longitude),
          status: "driving",
        });
      });
      return Array.from(seen.values());
    },
  });

  const { data: recentAlerts } = useQuery({
    queryKey: ["dashboard-alerts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts").select("*").eq("company_id", companyId!)
        .order("created_at", { ascending: false }).limit(8);
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <PageHeader
        title="Fleet Overview"
        subtitle={m?.company?.name ? `${m.company.name}${m.company.dot_number ? ` · DOT ${m.company.dot_number}` : ""}` : ""}
        actions={<Badge variant="outline" className="border-success/40 text-success"><span className="dot bg-success mr-1.5" /> Realtime</Badge>}
      />
      <div className="space-y-6 p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Active drivers" value={counts?.drivers ?? "—"} icon={Users} />
          <Kpi label="Vehicles" value={counts?.vehicles ?? "—"} icon={Truck} />
          <Kpi label="Open alerts" value={counts?.alerts ?? 0} icon={AlertTriangle} tone={counts?.alerts ? "warning" : "success"} />
          <Kpi label="Open defects" value={counts?.defects ?? 0} icon={ShieldCheck} tone={counts?.defects ? "danger" : "success"} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium tracking-wide text-muted-foreground">LIVE FLEET MAP</h3>
              <span className="text-xs text-muted-foreground">{gps?.length ?? 0} units tracked</span>
            </div>
            <LiveMap vehicles={gps ?? []} height={520} />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium tracking-wide text-muted-foreground">RECENT ALERTS</h3>
            <Card className="divide-y divide-border p-0">
              {(!recentAlerts || recentAlerts.length === 0) && (
                <div className="p-6 text-sm text-muted-foreground">
                  <Activity className="mb-2 h-5 w-5" />
                  No alerts. Your fleet is clean.
                </div>
              )}
              {recentAlerts?.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-4">
                  <div className={`mt-1.5 dot ${a.severity === "critical" ? "bg-destructive" : a.severity === "warning" ? "bg-warning" : "bg-info"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.title}</div>
                    {a.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</div>}
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> HOS COMPLIANCE
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div><div className="num text-xl font-semibold text-success">100%</div><div className="text-[10px] text-muted-foreground">Compliant</div></div>
                <div><div className="num text-xl font-semibold text-warning">0</div><div className="text-[10px] text-muted-foreground">Warnings</div></div>
                <div><div className="num text-xl font-semibold text-destructive">0</div><div className="text-[10px] text-muted-foreground">Violations</div></div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
