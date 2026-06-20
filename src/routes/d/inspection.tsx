import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/d/inspection")({ component: InspectionPage });

const STATUS_LABEL: Record<string, string> = {
  off_duty: "OFF", sleeper_berth: "SB", driving: "D",
  on_duty_not_driving: "ON", yard_move: "YM", personal_conveyance: "PC",
};

function InspectionPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);

  const { data: driver } = useQuery({
    queryKey: ["insp-driver", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id,company_id,cdl_number,cdl_state,vehicles(unit_number,vin),companies(name,dot_number)")
        .eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["insp-logs", user?.id], enabled: !!user,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 8);
      const { data } = await supabase
        .from("hos_logs")
        .select("duty_status,event_time,latitude,longitude,notes,location_text")
        .eq("driver_id", user!.id)
        .gte("event_time", since.toISOString())
        .order("event_time");
      return data ?? [];
    },
  });

  // Group logs by day
  const byDay: Record<string, any[]> = {};
  (logs ?? []).forEach((l: any) => {
    const day = new Date(l.event_time).toISOString().slice(0, 10);
    (byDay[day] ||= []).push(l);
  });
  const days = Object.keys(byDay).sort().reverse();

  function exportEld() {
    const header = `# FMCSA ELD Output File (CSV)\n# Driver: ${user?.email}\n# Generated: ${new Date().toISOString()}\n# Days: 8\n`;
    const rows = ["timestamp,duty_status,latitude,longitude,location,notes"];
    (logs ?? []).forEach((l: any) => {
      rows.push([l.event_time, l.duty_status, l.latitude ?? "", l.longitude ?? "", (l.location_text ?? "").replace(/,/g, " "), (l.notes ?? "").replace(/,/g, " ")].join(","));
    });
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `eld_${user?.id?.slice(0,8)}_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("ELD output exported");
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/d" className="text-xs text-muted-foreground">← Back</Link>
        <h1 className="text-sm font-semibold uppercase tracking-wide">DOT Inspection</h1>
        <div className="w-10" />
      </header>

      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-primary"><Shield className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Officer Mode</span></div>
          <div className="mt-2 text-sm text-muted-foreground">Hand the device to the officer. The last 8 days of HOS records are shown below.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pt-4 text-sm">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Carrier</div>
          <div className="font-medium">{driver?.companies?.name ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground">DOT {driver?.companies?.dot_number ?? "—"}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Vehicle</div>
          <div className="font-medium">Unit {driver?.vehicles?.unit_number ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground num">{driver?.vehicles?.vin ?? "—"}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] uppercase text-muted-foreground">License</div>
          <div className="font-medium num">{driver?.cdl_number ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground">{driver?.cdl_state ?? ""}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Days shown</div>
          <div className="font-medium num">{days.length} / 8</div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <Button className="h-12 w-full" onClick={exportEld}>Export ELD Output File</Button>
      </div>

      <div className="space-y-3 px-4 pt-5">
        {days.length === 0 && <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No logs in the last 8 days.</div>}
        {days.map((d) => (
          <div key={d} className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide">{new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
            <div className="divide-y divide-border">
              {byDay[d].map((l: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-7 rounded bg-muted px-1 text-center font-semibold">{STATUS_LABEL[l.duty_status] ?? "?"}</span>
                    <span className="num">{new Date(l.event_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {l.latitude != null ? `${Number(l.latitude).toFixed(2)},${Number(l.longitude).toFixed(2)}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
