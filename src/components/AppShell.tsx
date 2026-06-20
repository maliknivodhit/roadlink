import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Truck, Users, ClipboardList, Wrench, Fuel,
  BellRing, MessageSquare, Settings, ShieldCheck, LogOut, Radio, Map as MapIcon,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMembership, isManager } from "@/hooks/useMembership";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/map", label: "Live Map", icon: MapIcon },
  { to: "/drivers", label: "Drivers", icon: Users },
  { to: "/vehicles", label: "Vehicles", icon: Truck },
  { to: "/hos", label: "HOS Logs", icon: ClipboardList },
  { to: "/dvir", label: "DVIR", icon: Wrench },
  { to: "/ifta", label: "IFTA", icon: Fuel },
  { to: "/alerts", label: "Alerts", icon: BellRing },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/devices", label: "ELD Devices", icon: Radio },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { data: m } = useMembership();

  useEffect(() => {
    if (!loading && !user && loc.pathname !== "/auth") {
      nav({ to: "/auth", search: { redirect: loc.pathname } as any, replace: true });
    }
  }, [loading, user, nav, loc.pathname]);

  useEffect(() => {
    if (m && !m.profile?.company_id && loc.pathname !== "/onboarding") {
      nav({ to: "/onboarding", replace: true });
    }
  }, [m, nav, loc.pathname]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-background text-foreground">
      <aside className="flex flex-col border-r border-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">ROADLINK</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">ELD Platform</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4 opacity-80" />
                {n.label}
              </Link>
            );
          })}
          {isManager(m) && (
            <Link
              to="/admin"
              className={cn(
                "mt-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                loc.pathname.startsWith("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <ShieldCheck className="h-4 w-4 opacity-80" />
              Admin
            </Link>
          )}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-2 text-xs text-muted-foreground">
            <div className="truncate font-medium text-sidebar-foreground">{m?.profile?.full_name || m?.profile?.email}</div>
            <div className="truncate">{m?.company?.name ?? "No company"}</div>
          </div>
          <button
            onClick={() => signOut().then(() => nav({ to: "/auth" }))}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-h-screen">{children}</main>
    </div>
  );
}

export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between border-b border-border bg-card/40 px-8 py-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
