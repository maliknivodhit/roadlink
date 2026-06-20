import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMembership, isManager } from "@/hooks/useMembership";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createDriver } from "@/lib/drivers.functions";

export const Route = createFileRoute("/drivers")({ component: DriversPage });

const STATUS_TONE: Record<string, string> = {
  driving: "bg-success/15 text-success border-success/30",
  on_duty_not_driving: "bg-warning/15 text-warning border-warning/30",
  sleeper_berth: "bg-info/15 text-info border-info/30",
  off_duty: "bg-muted text-muted-foreground border-border",
  yard_move: "bg-primary/15 text-primary border-primary/30",
  personal_conveyance: "bg-accent text-accent-foreground border-border",
};

const emptyForm = {
  email: "", password: "", fullName: "", employeeId: "",
  cdlNumber: "", cdlState: "", cdlClass: "", cdlExpires: "",
  medicalCardExpires: "", vehicleId: "", hosCycle: "us_70_8" as const,
};

function DriversPage() {
  const { data: m } = useMembership();
  const qc = useQueryClient();
  const cid = m?.profile?.company_id;
  const canManage = isManager(m);
  const addDriver = useServerFn(createDriver);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: rows } = useQuery({
    queryKey: ["drivers", cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id,employee_id,cdl_number,cdl_state,cdl_expires,current_duty_status,hos_cycle,current_vehicle_id,profiles(full_name,email),vehicles(unit_number)")
        .eq("company_id", cid!);
      return data ?? [];
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-min", cid],
    enabled: !!cid && open,
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id,unit_number").eq("company_id", cid!).order("unit_number");
      return data ?? [];
    },
  });

  async function submit() {
    if (!form.email || !form.password || !form.fullName) {
      return toast.error("Email, password and full name are required");
    }
    setBusy(true);
    try {
      await addDriver({
        data: {
          ...form,
          vehicleId: form.vehicleId || undefined,
        },
      });
      toast.success(`Driver ${form.fullName} added`);
      setOpen(false);
      setForm({ ...emptyForm });
      qc.invalidateQueries({ queryKey: ["drivers", cid] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add driver");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Drivers" subtitle={`${rows?.length ?? 0} drivers`}
        actions={canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add driver</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add driver</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 max-h-[65vh] overflow-y-auto pr-1">
                <div className="col-span-2"><Label>Full name *</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
                <div><Label>Login email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Password *</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 8 chars" /></div>
                <div><Label>Employee ID</Label><Input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></div>
                <div>
                  <Label>Assigned vehicle</Label>
                  <Select value={form.vehicleId || "none"} onValueChange={(v) => setForm({ ...form, vehicleId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {vehicles?.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>Unit {v.unit_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>CDL #</Label><Input value={form.cdlNumber} onChange={(e) => setForm({ ...form, cdlNumber: e.target.value })} /></div>
                <div><Label>CDL state</Label><Input maxLength={2} value={form.cdlState} onChange={(e) => setForm({ ...form, cdlState: e.target.value.toUpperCase() })} /></div>
                <div><Label>CDL class</Label><Input value={form.cdlClass} onChange={(e) => setForm({ ...form, cdlClass: e.target.value })} placeholder="A / B / C" /></div>
                <div><Label>CDL expires</Label><Input type="date" value={form.cdlExpires} onChange={(e) => setForm({ ...form, cdlExpires: e.target.value })} /></div>
                <div><Label>Medical expires</Label><Input type="date" value={form.medicalCardExpires} onChange={(e) => setForm({ ...form, medicalCardExpires: e.target.value })} /></div>
                <div className="col-span-2">
                  <Label>HOS cycle</Label>
                  <Select value={form.hosCycle} onValueChange={(v) => setForm({ ...form, hosCycle: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us_70_8">US 70/8</SelectItem>
                      <SelectItem value="us_60_7">US 60/7</SelectItem>
                      <SelectItem value="canada_70_7">Canada 70/7</SelectItem>
                      <SelectItem value="canada_120_14">Canada 120/14</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create driver"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <div className="p-6">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>CDL</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Current status</TableHead>
                <TableHead>CDL Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!rows || rows.length === 0) && (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No drivers yet. Click “Add driver”.</TableCell></TableRow>
              )}
              {rows?.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-medium">{d.profiles?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{d.profiles?.email}</div>
                  </TableCell>
                  <TableCell className="num">{d.employee_id ?? "—"}</TableCell>
                  <TableCell className="num">{d.cdl_number ? `${d.cdl_state} · ${d.cdl_number}` : "—"}</TableCell>
                  <TableCell className="num">{d.vehicles?.unit_number ? `Unit ${d.vehicles.unit_number}` : "—"}</TableCell>
                  <TableCell className="text-xs uppercase tracking-wide">{d.hos_cycle}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_TONE[d.current_duty_status] ?? ""}>
                      {String(d.current_duty_status).replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="num text-xs">{d.cdl_expires ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}
