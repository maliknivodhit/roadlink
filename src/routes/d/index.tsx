import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMembership } from "@/hooks/useMembership";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, LogOut, Wrench, Fuel, ClipboardCheck, RadioTower, FileText } from "lucide-react";

export const Route = createFileRoute("/d/")({ component: DriverHome });

type Status = "off_duty" | "sleeper_berth" | "driving" | "on_duty_not_driving";

const STATUS_BTNS: { v: Status; label: string; color: string }[] = [
  { v: "off_duty", label: "OFF", color: "bg-slate-700" },
  { v: "sleeper_berth", label: "SB", color: "bg-sky-700" },
  { v: "driving", label: "D", color: "bg-emerald-600" },
  { v: "on_duty_not_driving", label: "ON", color: "bg-amber-600" },
];

function fmtClock(seconds: number) {
  if (seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function DriverHome() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: m } = useMembership();

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);

  const { data: driver } = useQuery({
    queryKey: ["driver-self", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id,company_id,current_duty_status,hos_cycle,current_vehicle_id,vehicles(unit_number)")
        .eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: todayLogs } = useQuery({
    queryKey: ["driver-today-logs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("hos_logs").select("*")
        .eq("driver_id", user!.id)
        .gte("event_time", start.toISOString())
        .order("event_time");
      return data ?? [];
    },
  });

  // Local-only HOS clock estimate (real engine runs server-side).
  const clocks = useMemo(() => {
    const events = todayLogs ?? [];
    let drive = 0, shift = 0;
    const now = Date.now();
    events.forEach((e, i) => {
      const next = events[i + 1];
      const t1 = +new Date(e.event_time);
      const t2 = next ? +new Date(next.event_time) : now;
      const dur = (t2 - t1) / 1000;
      if (e.duty_status === "driving") drive += dur;
      if (e.duty_status === "driving" || e.duty_status === "on_duty_not_driving" || e.duty_status === "yard_move") shift += dur;
    });
    return {
      driveRemaining: Math.max(0, 11 * 3600 - drive),
      shiftRemaining: Math.max(0, 14 * 3600 - shift),
      cycleRemaining: Math.max(0, 70 * 3600 - shift),
    };
  }, [todayLogs]);

  async function setStatus(v: Status) {
    if (!user || !driver?.company_id) return;
    // Try to capture GPS
    let lat: number | null = null, lng: number | null = null;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 }));
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch {}
    }
    const { error } = await supabase.from("hos_logs").insert({
      company_id: driver.company_id,
      driver_id: user.id,
      duty_status: v,
      origin: "driver",
      event_time: new Date().toISOString(),
      vehicle_id: driver.current_vehicle_id ?? null,
      latitude: lat, longitude: lng,
    });
    if (error) return toast.error(error.message);
    await supabase.from("drivers").update({ current_duty_status: v }).eq("id", user.id);
    if (lat != null && lng != null && driver.current_vehicle_id) {
      await supabase.from("gps_pings").insert({
        company_id: driver.company_id,
        vehicle_id: driver.current_vehicle_id,
        driver_id: user.id,
        latitude: lat,
        longitude: lng,
        recorded_at: new Date().toISOString(),
      });
    }
    qc.invalidateQueries({ queryKey: ["driver-self"] });
    qc.invalidateQueries({ queryKey: ["driver-today-logs"] });
    toast.success(`Status: ${v.replace(/_/g, " ")}`);
  }

  if (loading || !m) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;

  const current = driver?.current_duty_status ?? "off_duty";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground"><ShieldCheck className="h-4 w-4" /></div>
          <div>
            <div className="text-sm font-semibold leading-tight">{m.profile?.full_name ?? m.profile?.email}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{driver?.vehicles?.unit_number ? `Unit ${driver.vehicles.unit_number}` : "No vehicle"}</div>
          </div>
        </div>
        <button onClick={() => signOut().then(() => nav({ to: "/auth" }))} className="rounded-md p-2 text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /></button>
      </header>

      {/* Current status banner */}
      <div className="px-4 pt-5">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">CURRENT STATUS</div>
          <div className="mt-1 text-3xl font-semibold uppercase tracking-wide">{current.replace(/_/g, " ")}</div>
        </div>
      </div>

      {/* Duty status switcher */}
      <div className="grid grid-cols-4 gap-2 px-4 pt-4">
        {STATUS_BTNS.map((b) => (
          <button
            key={b.v}
            onClick={() => setStatus(b.v)}
            className={`h-20 rounded-xl text-xl font-bold text-white shadow-lg active:scale-95 transition ${b.color} ${current === b.v ? "ring-4 ring-white/40" : "opacity-80"}`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* HOS clocks */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-4">
        {[
          { label: "DRIVE", v: clocks.driveRemaining, max: 11 * 3600 },
          { label: "SHIFT", v: clocks.shiftRemaining, max: 14 * 3600 },
          { label: "CYCLE", v: clocks.cycleRemaining, max: 70 * 3600 },
        ].map((c) => {
          const pct = (c.v / c.max) * 100;
          const tone = pct < 12 ? "text-destructive" : pct < 30 ? "text-warning" : "text-success";
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
              <div className={`num mt-1 text-2xl font-semibold ${tone}`}>{fmtClock(c.v)}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${pct < 12 ? "bg-destructive" : pct < 30 ? "bg-warning" : "bg-success"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Action grid */}
      <div className="grid grid-cols-5 gap-2 px-4 pt-5">
        {[
          { to: "/d/dvir", label: "DVIR", icon: Wrench },
          { to: "/d/fuel", label: "Fuel", icon: Fuel },
          { to: "/d/trip", label: "Trip", icon: FileText },
          { to: "/d/inspection", label: "DOT", icon: ClipboardCheck },
          { to: "/d/messages", label: "Msgs", icon: RadioTower },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="flex aspect-square flex-col items-center justify-center rounded-xl border border-border bg-card text-xs text-muted-foreground active:bg-accent">
            <a.icon className="mb-1 h-5 w-5" /> {a.label}
          </Link>
        ))}
      </div>

      {/* Recent log */}
      <div className="px-4 pb-10 pt-5">
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">TODAY'S EVENTS</div>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {(!todayLogs || todayLogs.length === 0) && <div className="p-4 text-center text-sm text-muted-foreground">No events yet</div>}
          {todayLogs?.slice().reverse().map((l: any) => (
            <div key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="uppercase tracking-wide">{l.duty_status.replace(/_/g, " ")}</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {l.latitude != null && l.longitude != null && (
                  <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${l.latitude},${l.longitude}`} className="num">
                    📍 {Number(l.latitude).toFixed(2)},{Number(l.longitude).toFixed(2)}
                  </a>
                )}
                <span className="num">{new Date(l.event_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={async () => {
            const { data, error } = await supabase.functions.invoke("hos-engine", { body: { driver_id: user!.id } });
            if (error) return toast.error(error.message);
            const v = (data as any)?.violations ?? [];
            toast(v.length === 0 ? "No HOS violations ✓" : `${v.length} HOS issue(s)`, {
              description: v.length ? v.map((x: any) => x.rule).join(", ") : undefined,
            });
          }}
        >Run HOS check</Button>
      </div>
    </div>
  );
}
