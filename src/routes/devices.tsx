import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";

export const Route = createFileRoute("/devices")({ component: DevicesPage });

function DevicesPage() {
  const { data: m } = useMembership();
  const cid = m?.profile?.company_id;
  const { data } = useQuery({
    queryKey: ["devices", cid], enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from("eld_devices").select("*,vehicles(unit_number)").eq("company_id", cid!);
      return data ?? [];
    },
  });
  return (
    <AppShell>
      <PageHeader title="ELD Devices" subtitle="Registered telematics hardware" />
      <div className="p-6">
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Serial</th><th className="p-3">Model</th><th className="p-3">FW</th><th className="p-3">Vehicle</th><th className="p-3">Last seen</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {(!data || data.length === 0) && (<tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No devices registered.</td></tr>)}
              {data?.map((d: any) => (
                <tr key={d.id} className="border-b border-border/60">
                  <td className="p-3 num">{d.serial_number}</td>
                  <td className="p-3">{d.model ?? "—"}</td>
                  <td className="p-3 num text-xs">{d.firmware_version ?? "—"}</td>
                  <td className="p-3 num">{d.vehicles?.unit_number ?? "—"}</td>
                  <td className="p-3 num text-xs">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "—"}</td>
                  <td className="p-3"><Badge variant="outline" className={d.is_online ? "border-success/30 text-success" : "border-muted text-muted-foreground"}>{d.is_online ? "Online" : "Offline"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
