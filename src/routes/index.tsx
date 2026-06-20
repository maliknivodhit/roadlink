import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMembership, isDriver } from "@/hooks/useMembership";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const { data: m, isLoading } = useMembership();

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth", replace: true }); return; }
    if (isLoading) return;
    if (!m?.profile?.company_id) { nav({ to: "/onboarding", replace: true }); return; }
    if (isDriver(m) && m.roles.length === 1) { nav({ to: "/d", replace: true }); return; }
    nav({ to: "/dashboard", replace: true });
  }, [user, loading, m, isLoading, nav]);

  return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
}
