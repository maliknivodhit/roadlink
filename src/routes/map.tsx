import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { LiveMap } from "@/components/LiveMap";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";

export const Route = createFileRoute("/map")({ component: MapPage });

function MapPage() {
  const { data: m } = useMembership();
  const { data } = useQuery({
    queryKey: ["map", m?.profile?.company_id],
    enabled: !!m?.profile?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("gps_pings").select("vehicle_id,latitude,longitude")
        .eq("company_id", m!.profile!.company_id!)
        .order("recorded_at", { ascending: false }).limit(500);
      const seen = new Map();
      (data ?? []).forEach((p, i) => {
        if (!seen.has(p.vehicle_id)) seen.set(p.vehicle_id, {
          id: p.vehicle_id, unit: String(i + 1),
          lat: Number(p.latitude), lng: Number(p.longitude), status: "driving" as const,
        });
      });
      return Array.from(seen.values());
    },
  });
  return (
    <AppShell>
      <PageHeader title="Live Map" subtitle="Real-time vehicle positions" />
      <div className="p-6"><LiveMap vehicles={data ?? []} height="calc(100vh - 160px)" /></div>
    </AppShell>
  );
}
