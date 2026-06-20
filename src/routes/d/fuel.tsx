import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/d/fuel")({ component: FuelPage });

function FuelPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);

  const [gallons, setGallons] = useState("");
  const [ppg, setPpg] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [vendor, setVendor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: driver } = useQuery({
    queryKey: ["driver-self-fuel", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id,company_id,current_vehicle_id,vehicles(unit_number)")
        .eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["fuel-recent", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("ifta_fuel_purchases")
        .select("id,purchased_at,jurisdiction,gallons,total_amount,vendor")
        .eq("driver_id", user!.id)
        .order("purchased_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  async function submit() {
    if (!user || !driver?.company_id) return toast.error("No driver profile");
    if (!driver.current_vehicle_id) return toast.error("No vehicle assigned");
    if (!gallons || !jurisdiction) return toast.error("Gallons and jurisdiction required");
    setSubmitting(true);
    const g = Number(gallons), p = ppg ? Number(ppg) : null;
    const { error } = await supabase.from("ifta_fuel_purchases").insert({
      company_id: driver.company_id,
      vehicle_id: driver.current_vehicle_id,
      driver_id: user.id,
      purchased_at: new Date().toISOString(),
      jurisdiction: jurisdiction.toUpperCase(),
      gallons: g,
      price_per_gallon: p,
      total_amount: p ? Number((g * p).toFixed(2)) : null,
      vendor: vendor || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Fuel purchase logged");
    setGallons(""); setPpg(""); setVendor("");
    qc.invalidateQueries({ queryKey: ["fuel-recent"] });
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/d" className="text-xs text-muted-foreground">← Back</Link>
        <h1 className="text-sm font-semibold uppercase tracking-wide">Fuel</h1>
        <div className="w-10" />
      </header>

      <div className="space-y-3 px-4 pt-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Vehicle</div>
          <div className="mt-1 text-lg font-semibold">
            {driver?.vehicles?.unit_number ? `Unit ${driver.vehicles.unit_number}` : "No vehicle assigned"}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Gallons</label>
          <Input type="number" inputMode="decimal" value={gallons} onChange={(e) => setGallons(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Price / gallon</label>
          <Input type="number" inputMode="decimal" value={ppg} onChange={(e) => setPpg(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Jurisdiction (e.g. TX, ON)</label>
          <Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} maxLength={3} className="mt-1 uppercase" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Vendor</label>
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="mt-1" />
        </div>

        <Button className="h-12 w-full text-base" disabled={submitting} onClick={submit}>
          {submitting ? "Saving…" : "Log purchase"}
        </Button>
      </div>

      <div className="px-4 pt-6">
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Recent purchases</div>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {(!recent || recent.length === 0) && (
            <div className="p-4 text-center text-sm text-muted-foreground">No purchases yet</div>
          )}
          {recent?.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <div>{r.jurisdiction} · {r.gallons} gal</div>
                <div className="text-[10px] text-muted-foreground">{new Date(r.purchased_at).toLocaleString()} {r.vendor ? `· ${r.vendor}` : ""}</div>
              </div>
              <div className="num text-xs">{r.total_amount ? `$${r.total_amount}` : "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
