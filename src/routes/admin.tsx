import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMembership, isManager, type AppRole } from "@/hooks/useMembership";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { data: m } = useMembership();
  const qc = useQueryClient();
  const cid = m?.profile?.company_id;
  const canManage = isManager(m);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("driver");
  const [busy, setBusy] = useState(false);

  const { data: members } = useQuery({
    queryKey: ["members", cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id,email,full_name").eq("company_id", cid!);
      const ids = (profiles ?? []).map((p) => p.id);
      const { data: roles } = ids.length ? await supabase.from("user_roles").select("user_id,role").in("user_id", ids) : { data: [] as any[] };
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
      }));
    },
  });

  async function invite() {
    if (!cid || !email) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("invite-member", {
      body: { email, role, company_id: cid },
    });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Failed");
    setOpen(false); setEmail("");
    qc.invalidateQueries({ queryKey: ["members", cid] });
    toast.success(`Invited ${email}`);
  }

  if (!canManage) {
    return <AppShell><PageHeader title="Admin" /><div className="p-6"><Card className="p-12 text-center text-sm text-muted-foreground"><ShieldOff className="mx-auto mb-2 h-6 w-6" /> You don't have access.</Card></div></AppShell>;
  }

  return (
    <AppShell>
      <PageHeader title="Admin" subtitle="Manage members, roles, and access"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><UserPlus className="h-4 w-4 mr-1" /> Invite member</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite to company</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div>
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="dispatcher">Dispatcher</SelectItem>
                      <SelectItem value="compliance_officer">Compliance officer</SelectItem>
                      <SelectItem value="mechanic">Mechanic</SelectItem>
                      <SelectItem value="fleet_admin">Fleet admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button disabled={busy} onClick={invite}>Send invite</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="p-6">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Roles</TableHead></TableRow></TableHeader>
            <TableBody>
              {members?.map((mb) => (
                <TableRow key={mb.id}>
                  <TableCell>{mb.full_name ?? "—"}</TableCell>
                  <TableCell className="num text-xs">{mb.email}</TableCell>
                  <TableCell className="flex gap-1">
                    {mb.roles.length === 0 ? <span className="text-xs text-muted-foreground">—</span> :
                      mb.roles.map((r: string) => <Badge key={r} variant="outline">{r}</Badge>)}
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
