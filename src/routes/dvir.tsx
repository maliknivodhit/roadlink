import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/useMembership";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/dvir")({ component: DvirPage });

function DvirPage() {
  const { data: m } = useMembership();
  const cid = m?.profile?.company_id;
  const [open, setOpen] = useState<string | null>(null);

  const { data: reports } = useQuery({
    queryKey: ["dvir", cid], enabled: !!cid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dvir_reports")
        .select("id,inspection_type,inspected_at,safe_to_operate,notes,odometer_km,vehicles(unit_number),driver:drivers!dvir_reports_driver_id_fkey(profile:profiles!drivers_id_fkey(full_name,email)),defects:dvir_defects(id,component,severity)")
        .eq("company_id", cid!).order("inspected_at", { ascending: false }).limit(100);
      if (error) console.error(error);
      return data ?? [];
    },
  });

  const { data: defects } = useQuery({
    queryKey: ["dvir-defects", open], enabled: !!open,
    queryFn: async () => {
      const { data } = await supabase
        .from("dvir_defects")
        .select("*")
        .eq("report_id", open!)
        .order("created_at");
      return data ?? [];
    },
  });

  const selected = reports?.find((r: any) => r.id === open);

  return (
    <AppShell>
      <PageHeader title="DVIR" subtitle="Driver Vehicle Inspection Reports" />
      <div className="p-6">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Vehicle</TableHead>
              <TableHead>Driver</TableHead><TableHead>Defects</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(!reports || reports.length === 0) && (
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No inspections yet.</TableCell></TableRow>
              )}
              {reports?.map((r: any) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(r.id)}>
                  <TableCell className="num text-xs">{new Date(r.inspected_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs uppercase">{r.inspection_type}</TableCell>
                  <TableCell className="num">{r.vehicles?.unit_number ?? "—"}</TableCell>
                  <TableCell>{r.driver?.profile?.full_name ?? r.driver?.profile?.email ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.defects?.length ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={r.safe_to_operate ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}>
                      {r.safe_to_operate ? "Safe to operate" : "Out of service"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Inspection — {selected ? new Date((selected as any).inspected_at).toLocaleString() : ""}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div><div className="text-xs text-muted-foreground">Type</div><div className="uppercase">{(selected as any).inspection_type}</div></div>
                <div><div className="text-xs text-muted-foreground">Vehicle</div><div>{(selected as any).vehicles?.unit_number ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Driver</div><div>{(selected as any).driver?.profile?.full_name ?? (selected as any).driver?.profile?.email ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Odometer</div><div className="num">{(selected as any).odometer_km ?? "—"}</div></div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">Notes</div><div>{(selected as any).notes ?? "—"}</div></div>
              </div>
              <div>
                <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Defects</div>
                {(!defects || defects.length === 0) && <div className="rounded-md border border-border p-4 text-center text-muted-foreground">No defects reported.</div>}
                <div className="space-y-2">
                  {defects?.map((d: any) => (
                    <div key={d.id} className="flex items-start justify-between rounded-md border border-border p-3">
                      <div>
                        <div className="font-medium">{d.component}</div>
                        {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}
                      </div>
                      <Badge variant="outline" className={
                        d.severity === "out_of_service" ? "border-destructive/40 text-destructive" :
                        d.severity === "major" ? "border-warning/40 text-warning" :
                        "border-border text-muted-foreground"
                      }>{d.severity.replace(/_/g, " ")}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
