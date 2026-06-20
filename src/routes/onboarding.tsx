import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { useMembership } from "@/hooks/useMembership";
import { createCompanyForCurrentUser } from "@/lib/onboarding.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

function Onboarding() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const createCompany = useServerFn(createCompanyForCurrentUser);
  const { data: m } = useMembership();
  const [name, setName] = useState("");
  const [dot, setDot] = useState("");
  const [tz, setTz] = useState("America/Chicago");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [loading, user, nav]);
  useEffect(() => { if (m?.profile?.company_id) nav({ to: "/dashboard" }); }, [m, nav]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await createCompany({ data: { name, dotNumber: dot || undefined, timezone: tz } });
      await qc.invalidateQueries({ queryKey: ["membership"] });
      toast.success("Company created");
      nav({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <form onSubmit={create} className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground"><ShieldCheck className="h-4 w-4" /></div>
          <div>
            <h1 className="text-lg font-semibold">Set up your fleet</h1>
            <p className="text-xs text-muted-foreground">You'll be the fleet administrator.</p>
          </div>
        </div>
        <div><Label>Company name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Logistics Inc." /></div>
        <div><Label>USDOT number (optional)</Label><Input value={dot} onChange={(e) => setDot(e.target.value)} placeholder="1234567" /></div>
        <div>
          <Label>Home terminal timezone</Label>
          <Select value={tz} onValueChange={setTz}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="America/New_York">Eastern</SelectItem>
              <SelectItem value="America/Chicago">Central</SelectItem>
              <SelectItem value="America/Denver">Mountain</SelectItem>
              <SelectItem value="America/Phoenix">Arizona</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
              <SelectItem value="America/Anchorage">Alaska</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button disabled={busy} className="w-full">Create company</Button>
      </form>
    </div>
  );
}
