import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMembership, isManager } from "@/hooks/useMembership";
import { toast } from "sonner";
import { MapPin, Pencil, Download, ClipboardCheck, ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/hos")({ component: HosPage });

type Duty = "off_duty" | "sleeper_berth" | "driving" | "on_duty_not_driving" | "yard_move" | "personal_conveyance";
const DRIVING_SET: Duty[] = ["driving", "yard_move", "personal_conveyance"];
const ALL_STATUSES: Duty[] = ["off_duty", "sleeper_berth", "driving", "on_duty_not_driving", "yard_move", "personal_conveyance"];
const STATUS_LABEL: Record<Duty, string> = {
  off_duty: "Off Duty", sleeper_berth: "Sleeper", driving: "Driving",
  on_duty_not_driving: "On Duty", yard_move: "Yard Move", personal_conveyance: "Personal Conv.",
};
const COLORS: Record<string, string> = {
  off_duty: "#475569", sleeper_berth: "#0ea5e9", driving: "#22c55e",
  on_duty_not_driving: "#f59e0b", yard_move: "#a855f7", personal_conveyance: "#64748b",
};
const ROWS: Duty[] = ["off_duty", "sleeper_berth", "driving", "on_duty_not_driving"];

function dayKey(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

// Build a continuous event series for `day`. If the driver has no event at midnight,
// carry the last known status forward by prepending a synthetic event at day start.
function eventsForDay(allLogs: any[], day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const sorted = [...allLogs].sort((a, b) => +new Date(a.event_time) - +new Date(b.event_time));
  const inDay = sorted.filter((e) => {
    const t = +new Date(e.event_time);
    return t >= +dayStart && t < +dayEnd;
  });
  const firstInDayTime = inDay.length ? +new Date(inDay[0].event_time) : +dayEnd;
  if (firstInDayTime > +dayStart) {
    // Find the most recent prior event to carry forward
    const priors = sorted.filter((e) => +new Date(e.event_time) < +dayStart);
    const last = priors[priors.length - 1];
    if (last) {
      inDay.unshift({
        ...last,
        id: `carry-${last.id}-${dayKey(day)}`,
        event_time: dayStart.toISOString(),
        _carried: true,
      });
    }
  }
  return inDay;
}

function LogGrid({ events, day }: { events: any[]; day: Date }) {
  const W = 1200, H = 200, PAD_L = 90;
  const rowH = (H - 20) / ROWS.length;
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const span = dayEnd.getTime() - dayStart.getTime();
  const xFor = (t: Date) => PAD_L + Math.max(0, Math.min(1, (t.getTime() - dayStart.getTime()) / span)) * (W - PAD_L - 10);
  const sorted = [...events].sort((a, b) => +new Date(a.event_time) - +new Date(b.event_time));
  const isToday = dayKey(day) === dayKey(new Date());
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {ROWS.map((r, i) => (
        <g key={r}>
          <rect x={PAD_L} y={10 + i * rowH} width={W - PAD_L - 10} height={rowH} fill="transparent" stroke="rgba(255,255,255,0.08)" />
          <text x={10} y={10 + i * rowH + rowH / 2 + 4} fontSize="11" fill="rgba(255,255,255,0.75)">{STATUS_LABEL[r]}</text>
        </g>
      ))}
      {Array.from({ length: 25 }).map((_, h) => {
        const x = PAD_L + (h / 24) * (W - PAD_L - 10);
        return (
          <g key={h}>
            <line x1={x} y1={10} x2={x} y2={H - 10} stroke="rgba(255,255,255,0.06)" />
            {h % 3 === 0 && <text x={x} y={H - 2} fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.5)">{h}</text>}
          </g>
        );
      })}
      {sorted.map((e, i) => {
        const next = sorted[i + 1];
        const t1 = new Date(Math.max(+new Date(e.event_time), +dayStart));
        const endCap = isToday ? Math.min(Date.now(), +dayEnd) : +dayEnd;
        const t2 = next ? new Date(Math.min(+new Date(next.event_time), +dayEnd)) : new Date(endCap);
        const baseRow: Duty =
          e.duty_status === "driving" ? "driving"
          : e.duty_status === "yard_move" ? "on_duty_not_driving"
          : e.duty_status === "personal_conveyance" ? "off_duty"
          : e.duty_status;
        const rowIdx = ROWS.indexOf(baseRow);
        if (rowIdx < 0) return null;
        const x1 = xFor(t1), x2 = xFor(t2);
        const y = 10 + rowIdx * rowH + rowH / 2;
        return <line key={e.id} x1={x1} y1={y} x2={x2} y2={y} stroke={COLORS[e.duty_status]} strokeWidth={6} strokeLinecap="square" />;
      })}
    </svg>
  );
}

function HosPage() {
  const { data: m } = useMembership();
  const cid = m?.profile?.company_id;
  const qc = useQueryClient();
  const canEdit = isManager(m);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ duty_status: "off_duty" as Duty, event_time: "", notes: "", reason: "" });
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfRange, setPdfRange] = useState({ from: dayKey(new Date()), to: dayKey(new Date()) });

  const { data: drivers } = useQuery({
    queryKey: ["hos-drivers", cid], enabled: !!cid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id,company_id,current_duty_status,profile:profiles!drivers_id_fkey(full_name,email)")
        .eq("company_id", cid!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: company } = useQuery({
    queryKey: ["company", cid], enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("name,dot_number,timezone").eq("id", cid!).maybeSingle();
      return data;
    },
  });

  // Pull ALL logs for the selected driver (cap to ~1 year). We need history before the
  // viewed day so we can carry the last known status forward across gaps.
  const { data: driverLogs } = useQuery({
    queryKey: ["hos-driver-logs", selectedDriver?.id],
    enabled: !!selectedDriver,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 365);
      const { data } = await supabase
        .from("hos_logs")
        .select("id,driver_id,duty_status,event_time,latitude,longitude,location_text,notes,company_id,vehicle_id")
        .eq("driver_id", selectedDriver.id)
        .gte("event_time", since.toISOString())
        .order("event_time");
      return data ?? [];
    },
  });

  const { data: driverDvir } = useQuery({
    queryKey: ["hos-driver-dvir", selectedDriver?.id],
    enabled: !!selectedDriver,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 365);
      const { data } = await supabase
        .from("dvir_reports")
        .select("id,inspection_type,inspected_at,safe_to_operate,vehicle:vehicles(unit_number),defects:dvir_defects(id)")
        .eq("driver_id", selectedDriver.id)
        .gte("inspected_at", since.toISOString())
        .order("inspected_at", { ascending: false });
      return data ?? [];
    },
  });

  const dayEvents = useMemo(
    () => (driverLogs ? eventsForDay(driverLogs, selectedDate) : []),
    [driverLogs, selectedDate],
  );
  const dayDvir = useMemo(() => {
    const k = dayKey(selectedDate);
    return (driverDvir ?? []).filter((r: any) => dayKey(new Date(r.inspected_at)) === k);
  }, [driverDvir, selectedDate]);

  function openEdit(log: any) {
    if (log._carried) {
      toast.info("Carried-over status — add a new event on this day to change it.");
      return;
    }
    const ageDays = (Date.now() - +new Date(log.event_time)) / 86400000;
    if (ageDays > 7) {
      toast.error("Events older than 7 days cannot be edited.");
      return;
    }
    setEditing(log);
    setForm({
      duty_status: log.duty_status,
      event_time: new Date(log.event_time).toISOString().slice(0, 16),
      notes: log.notes ?? "",
      reason: "",
    });
  }
  const allowedStatuses = ALL_STATUSES;

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase.rpc("manager_edit_hos_log", {
      _log_id: editing.id,
      _new_duty_status: form.duty_status,
      _new_event_time: new Date(form.event_time).toISOString(),
      _new_notes: form.notes,
      _reason: form.reason || "Manager edit",
    });
    if (error) return toast.error(error.message);
    toast.success("Log updated");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["hos-driver-logs"] });
  }

  function downloadPdf() {
    if (!selectedDriver || !driverLogs) return;
    const from = new Date(pdfRange.from + "T00:00:00");
    const to = new Date(pdfRange.to + "T00:00:00");
    if (+to < +from) return toast.error("End date must be after start date");
    const keys: string[] = [];
    for (let d = new Date(from); +d <= +to; d = addDays(d, 1)) keys.push(dayKey(d));
    const doc = new jsPDF({ orientation: "landscape" });
    const driverName = selectedDriver.profile?.full_name ?? selectedDriver.profile?.email ?? "Driver";

    keys.forEach((k, idx) => {
      if (idx > 0) doc.addPage();
      const day = new Date(k + "T00:00:00");
      doc.setFontSize(14); doc.text(`HOS Daily Log — ${driverName}`, 14, 14);
      doc.setFontSize(10);
      doc.text(`Date: ${day.toDateString()}`, 14, 22);
      doc.text(`Carrier: ${company?.name ?? "-"}  DOT#: ${company?.dot_number ?? "-"}`, 14, 28);

      const evs = eventsForDay(driverLogs, day);
      const rows = evs.map((e) => [
        new Date(e.event_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        STATUS_LABEL[e.duty_status as Duty] + (e._carried ? " (carried)" : ""),
        e.latitude != null ? `${Number(e.latitude).toFixed(3)}, ${Number(e.longitude).toFixed(3)}` : (e.location_text ?? "-"),
        e.notes ?? "",
      ]);
      autoTable(doc, {
        startY: 34,
        head: [["Time", "Status", "Location", "Notes"]],
        body: rows.length ? rows : [["—", "No activity", "—", "—"]],
        styles: { fontSize: 8 }, headStyles: { fillColor: [30,41,59] },
      });

      const dv = (driverDvir ?? []).filter((r: any) => dayKey(new Date(r.inspected_at)) === k);
      const afterY = (doc as any).lastAutoTable?.finalY ?? 40;
      doc.setFontSize(11); doc.text("DVIR Reports", 14, afterY + 8);
      if (dv.length === 0) {
        doc.setFontSize(9); doc.text("None", 14, afterY + 14);
      } else {
        autoTable(doc, {
          startY: afterY + 10,
          head: [["Time", "Type", "Unit", "Defects"]],
          body: dv.map((r: any) => [
            new Date(r.inspected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            r.inspection_type, r.vehicle?.unit_number ?? "-",
            (!r.safe_to_operate || (r.defects && r.defects.length > 0)) ? "Yes" : "No",
          ]),
          styles: { fontSize: 8 }, headStyles: { fillColor: [30,41,59] },
        });
      }
    });

    doc.save(`hos-${driverName.replace(/\s+/g,"_")}-${pdfRange.from}_to_${pdfRange.to}.pdf`);
    setPdfOpen(false);
  }

  // --- Driver list view ---
  if (!selectedDriver) {
    return (
      <AppShell>
        <PageHeader title="HOS Logs" subtitle="Select a driver to view their logbook" />
        <div className="grid gap-3 p-6 md:grid-cols-2 lg:grid-cols-3">
          {(!drivers || drivers.length === 0) && <Card className="col-span-full p-12 text-center text-sm text-muted-foreground">No drivers yet.</Card>}
          {drivers?.map((d: any) => (
            <Card key={d.id} className="cursor-pointer p-4 hover:bg-accent" onClick={() => { setSelectedDriver(d); setSelectedDate(startOfDay(new Date())); }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{d.profile?.full_name ?? d.profile?.email ?? "Driver"}</div>
                  <div className="text-xs uppercase text-muted-foreground">{(d.current_duty_status ?? "off_duty").replace(/_/g," ")}</div>
                </div>
                <Badge variant="outline">View log</Badge>
              </div>
            </Card>
          ))}
        </div>
      </AppShell>
    );
  }

  // --- Driver detail view ---
  const driverName = selectedDriver.profile?.full_name ?? selectedDriver.profile?.email ?? "Driver";
  const isTodaySelected = dayKey(selectedDate) === dayKey(new Date());
  const todayKey = dayKey(new Date());

  return (
    <AppShell>
      <PageHeader title={`HOS — ${driverName}`} subtitle={selectedDate.toDateString()} />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedDriver(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" />All drivers
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={dayKey(selectedDate)}
              max={todayKey}
              onChange={(e) => e.target.value && setSelectedDate(startOfDay(new Date(e.target.value + "T00:00:00")))}
              className="w-[160px]"
            />
            <Button variant="outline" size="sm" disabled={isTodaySelected}
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={isTodaySelected}
              onClick={() => setSelectedDate(startOfDay(new Date()))}>
              <CalendarDays className="mr-1 h-4 w-4" />Today
            </Button>
            <Button size="sm" onClick={() => { setPdfRange({ from: dayKey(addDays(selectedDate, -6)), to: dayKey(selectedDate) }); setPdfOpen(true); }}>
              <Download className="mr-1 h-4 w-4" />Download PDF
            </Button>
          </div>
        </div>

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {dayEvents.length === 0
                ? "No activity recorded"
                : `${dayEvents.filter((e: any) => !e._carried).length} event(s) on this day${dayEvents.some((e: any) => e._carried) ? " · carried-over status shown from last known event" : ""}`}
            </div>
            {dayDvir.length > 0 && (
              <Badge variant="outline" className="gap-1">
                <ClipboardCheck className="h-3 w-3" />
                DVIR {dayDvir.some((r: any) => (!r.safe_to_operate || (r.defects && r.defects.length > 0))) ? "with defects" : "OK"}
              </Badge>
            )}
          </div>
          {dayEvents.length > 0
            ? <LogGrid events={dayEvents} day={selectedDate} />
            : <div className="py-10 text-center text-xs text-muted-foreground">No prior status to carry forward — driver has no logged events yet.</div>}

          {dayEvents.length > 0 && (
            <div className="mt-3 divide-y divide-border rounded-md border border-border">
              {dayEvents.slice().reverse().map((l: any) => (
                <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[l.duty_status] }} />
                    <span className="uppercase">{STATUS_LABEL[l.duty_status as Duty]}</span>
                    {l._carried && <Badge variant="outline" className="text-[10px]">carried-over</Badge>}
                    {DRIVING_SET.includes(l.duty_status) && !l._carried && <Badge variant="outline" className="text-[10px]">driving-type</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {l.latitude != null && l.longitude != null && (
                      <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${l.latitude},${l.longitude}`} className="flex items-center gap-1 hover:text-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="num">{Number(l.latitude).toFixed(3)}, {Number(l.longitude).toFixed(3)}</span>
                      </a>
                    )}
                    <span className="num">{new Date(l.event_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {canEdit && !l._carried && (
                      <Button size="sm" variant="ghost" onClick={() => openEdit(l)}><Pencil className="h-3 w-3" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {dayDvir.length > 0 && (
            <div className="mt-3 rounded-md border border-border p-2 text-xs">
              <div className="mb-1 font-medium text-muted-foreground">DVIR</div>
              {dayDvir.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-1">
                  <span>{r.inspection_type} · Unit {r.vehicle?.unit_number ?? "-"}</span>
                  <span className={(!r.safe_to_operate || (r.defects && r.defects.length > 0)) ? "text-warning" : "text-success"}>
                    {(!r.safe_to_operate || (r.defects && r.defects.length > 0)) ? "Defects" : "No defects"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Download HOS PDF</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From</Label>
              <Input type="date" value={pdfRange.from} max={todayKey} onChange={(e) => setPdfRange({ ...pdfRange, from: e.target.value })} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={pdfRange.to} max={todayKey} onChange={(e) => setPdfRange({ ...pdfRange, to: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfOpen(false)}>Cancel</Button>
            <Button onClick={downloadPdf}><Download className="mr-1 h-4 w-4" />Download</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit log entry</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                Edits allowed for events within the last 7 days. Change recorded in audit log.
              </div>
              <div>
                <Label>Duty status</Label>
                <Select value={form.duty_status} onValueChange={(v) => setForm({ ...form, duty_status: v as Duty })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedStatuses.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Event time</Label><Input type="datetime-local" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <div><Label>Reason for edit</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. corrected on-duty start time" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
