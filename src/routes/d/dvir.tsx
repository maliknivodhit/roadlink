import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/d/dvir")({ component: DvirPage });

const COMPONENTS = [
  "Brakes", "Tires", "Lights", "Steering", "Mirrors", "Windshield/Wipers",
  "Horn", "Coupling devices", "Emergency equipment", "Fuel system",
  "Exhaust", "Suspension", "Trailer", "Other",
];

type Defect = { component: string; description: string; severity: "minor" | "major" | "out_of_service" };

function DvirPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);

  const [type, setType] = useState<"pre_trip" | "post_trip">("pre_trip");
  const [odometer, setOdometer] = useState("");
  const [notes, setNotes] = useState("");
  const [defects, setDefects] = useState<Defect[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: driver } = useQuery({
    queryKey: ["driver-self-dvir", user?.id],
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
    queryKey: ["dvir-recent", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("dvir_reports")
        .select("id,inspection_type,inspected_at,safe_to_operate,vehicles(unit_number)")
        .eq("driver_id", user!.id)
        .order("inspected_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  function addDefect(component: string) {
    setDefects((d) => [...d, { component, description: "", severity: "minor" }]);
  }
  function updateDefect(i: number, patch: Partial<Defect>) {
    setDefects((d) => d.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function removeDefect(i: number) {
    setDefects((d) => d.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!user || !driver?.company_id) return toast.error("No driver profile");
    if (!driver.current_vehicle_id) return toast.error("No vehicle assigned. Ask your manager.");
    if (defects.some((d) => !d.description.trim())) return toast.error("Describe each defect");

    setSubmitting(true);
    const safe = !defects.some((d) => d.severity === "out_of_service");
    const { data: report, error } = await supabase
      .from("dvir_reports")
      .insert({
        company_id: driver.company_id,
        driver_id: user.id,
        vehicle_id: driver.current_vehicle_id,
        inspection_type: type,
        odometer_km: odometer ? Number(odometer) : null,
        safe_to_operate: safe,
        notes: notes || null,
      })
      .select("id").single();

    if (error || !report) {
      setSubmitting(false);
      return toast.error(error?.message ?? "Failed to submit");
    }

    if (defects.length > 0) {
      const { error: dErr } = await supabase.from("dvir_defects").insert(
        defects.map((d) => ({
          report_id: report.id,
          company_id: driver.company_id,
          component: d.component,
          description: d.description,
          severity: d.severity,
        })),
      );
      if (dErr) {
        setSubmitting(false);
        return toast.error(dErr.message);
      }
    }

    toast.success(safe ? "DVIR submitted — safe to operate" : "DVIR submitted — OUT OF SERVICE");
    setDefects([]); setNotes(""); setOdometer("");
    qc.invalidateQueries({ queryKey: ["dvir-recent"] });
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/d" className="text-xs text-muted-foreground">← Back</Link>
        <h1 className="text-sm font-semibold uppercase tracking-wide">DVIR</h1>
        <div className="w-10" />
      </header>

      <div className="px-4 pt-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Vehicle</div>
          <div className="mt-1 text-lg font-semibold">
            {driver?.vehicles?.unit_number ? `Unit ${driver.vehicles.unit_number}` : "No vehicle assigned"}
          </div>
        </div>
      </div>

      {/* Type */}
      <div className="grid grid-cols-2 gap-2 px-4 pt-3">
        {(["pre_trip", "post_trip"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`h-12 rounded-lg border text-sm font-semibold uppercase tracking-wide transition ${
              type === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >
            {t === "pre_trip" ? "Pre-trip" : "Post-trip"}
          </button>
        ))}
      </div>

      {/* Odometer */}
      <div className="px-4 pt-3">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Odometer (km)</label>
        <Input type="number" inputMode="decimal" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="0" className="mt-1" />
      </div>

      {/* Components */}
      <div className="px-4 pt-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tap a component to flag a defect</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {COMPONENTS.map((c) => (
            <button key={c} onClick={() => addDefect(c)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent">
              <Plus className="mr-1 inline h-3 w-3" />{c}
            </button>
          ))}
        </div>
      </div>

      {/* Defect list */}
      {defects.length > 0 && (
        <div className="space-y-2 px-4 pt-4">
          {defects.map((d, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{d.component}</div>
                <button onClick={() => removeDefect(i)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Textarea
                placeholder="Describe the defect…"
                value={d.description}
                onChange={(e) => updateDefect(i, { description: e.target.value })}
                className="mt-2"
              />
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["minor", "major", "out_of_service"] as const).map((s) => (
                  <button key={s} onClick={() => updateDefect(i, { severity: s })}
                    className={`rounded-md border px-2 py-1.5 text-[11px] uppercase tracking-wide ${
                      d.severity === s
                        ? s === "out_of_service" ? "border-destructive bg-destructive text-destructive-foreground"
                          : s === "major" ? "border-warning bg-warning text-warning-foreground"
                          : "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}>
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      <div className="px-4 pt-4">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional remarks" className="mt-1" />
      </div>

      {/* Status preview */}
      <div className="px-4 pt-4">
        {defects.some((d) => d.severity === "out_of_service") ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="h-4 w-4" /> <span className="text-sm font-medium">Vehicle OUT OF SERVICE</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-success">
            <CheckCircle2 className="h-4 w-4" /> <span className="text-sm font-medium">Safe to operate</span>
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        <Button className="h-12 w-full text-base" disabled={submitting} onClick={submit}>
          {submitting ? "Submitting…" : "Submit DVIR"}
        </Button>
      </div>

      {/* Recent */}
      <div className="px-4 pt-6">
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Recent inspections</div>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {(!recent || recent.length === 0) && (
            <div className="p-4 text-center text-sm text-muted-foreground">No inspections yet</div>
          )}
          {recent?.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <div className="text-xs uppercase">{r.inspection_type.replace("_", "-")}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(r.inspected_at).toLocaleString()}</div>
              </div>
              <Badge variant="outline" className={r.safe_to_operate ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}>
                {r.safe_to_operate ? "Safe" : "OOS"}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
