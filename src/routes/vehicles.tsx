import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMembership, isManager } from "@/hooks/useMembership";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/vehicles")({ component: VehiclesPage });

function VehiclesPage() {
  const { data: m } = useMembership();
  const qc = useQueryClient();
  const cid = m?.profile?.company_id;
  const canManage = isManager(m);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ unit_number: "", vin: "", make: "", model: "", year: "", license_plate: "", license_state: "" });

  const { data: rows } = useQuery({
    queryKey: ["vehicles", cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("*").eq("company_id", cid!).order("unit_number");
      return data ?? [];
    },
  });

  async function create() {
    if (!cid || !form.unit_number) return;
    const { error } = await supabase.from("vehicles").insert({
      ...form,
      company_id: cid,
      year: form.year ? Number(form.year) : null,
    });
    if (error) return toast.error(error.message);
    setOpen(false); setForm({ unit_number: "", vin: "", make: "", model: "", year: "", license_plate: "", license_state: "" });
    qc.invalidateQueries({ queryKey: ["vehicles", cid] });
    toast.success("Vehicle added");
  }

  return (
    <AppShell>
      <PageHeader title="Vehicles" subtitle={`${rows?.length ?? 0} vehicles in fleet`}
        actions={canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add vehicle</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add vehicle</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Unit #</Label><Input value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} /></div>
                <div className="col-span-2"><Label>VIN</Label><Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} /></div>
                <div><Label>Make</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
                <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
                <div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
                <div><Label>Plate</Label><Input value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value })} /></div>
                <div><Label>State</Label><Input maxLength={2} value={form.license_state} onChange={(e) => setForm({ ...form, license_state: e.target.value.toUpperCase() })} /></div>
              </div>
              <DialogFooter><Button onClick={create}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <div className="p-6">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead><TableHead>VIN</TableHead><TableHead>Make / Model</TableHead>
                <TableHead>Year</TableHead><TableHead>Plate</TableHead><TableHead>Odometer</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!rows || rows.length === 0) && (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No vehicles yet.</TableCell></TableRow>
              )}
              {rows?.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell className="num font-medium">{v.unit_number}</TableCell>
                  <TableCell className="num text-xs">{v.vin ?? "—"}</TableCell>
                  <TableCell>{[v.make, v.model].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell className="num">{v.year ?? "—"}</TableCell>
                  <TableCell className="num text-xs">{v.license_plate ? `${v.license_state ?? ""} ${v.license_plate}` : "—"}</TableCell>
                  <TableCell className="num text-xs">{v.odometer_km ? `${Number(v.odometer_km).toLocaleString()} km` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={v.status === "active" ? "border-success/30 text-success" : "border-warning/30 text-warning"}>
                      {v.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}
