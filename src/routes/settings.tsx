import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMembership } from "@/hooks/useMembership";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { data: m, refetch } = useMembership();
  const [name, setName] = useState("");
  const [dot, setDot] = useState("");
  useEffect(() => { if (m?.company) { setName(m.company.name); setDot(m.company.dot_number ?? ""); } }, [m]);

  async function save() {
    if (!m?.company?.id) return;
    const { error } = await supabase.from("companies").update({ name, dot_number: dot || null }).eq("id", m.company.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    refetch();
  }

  return (
    <AppShell>
      <PageHeader title="Settings" />
      <div className="max-w-xl space-y-4 p-6">
        <Card className="space-y-4 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Company</h3>
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>USDOT</Label><Input value={dot} onChange={(e) => setDot(e.target.value)} /></div>
          <Button onClick={save}>Save</Button>
        </Card>
        <Card className="space-y-2 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Account</h3>
          <div className="text-sm">{m?.profile?.full_name}</div>
          <div className="text-xs text-muted-foreground">{m?.profile?.email}</div>
          <div className="text-xs text-muted-foreground">Roles: {m?.roles.join(", ") || "none"}</div>
        </Card>
      </div>
    </AppShell>
  );
}
