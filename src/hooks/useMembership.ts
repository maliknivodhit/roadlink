import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole =
  | "super_admin"
  | "fleet_admin"
  | "dispatcher"
  | "compliance_officer"
  | "driver"
  | "mechanic";

export interface Membership {
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    company_id: string | null;
  } | null;
  company: { id: string; name: string; dot_number: string | null } | null;
  roles: AppRole[];
}

export function useMembership() {
  const { user } = useAuth();
  return useQuery<Membership>({
    queryKey: ["membership", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name,company_id").eq("id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      let company = null;
      if (profile?.company_id) {
        const { data } = await supabase
          .from("companies")
          .select("id,name,dot_number")
          .eq("id", profile.company_id)
          .maybeSingle();
        company = data;
      }
      return {
        profile,
        company,
        roles: (roles ?? []).map((r) => r.role as AppRole),
      };
    },
  });
}

export const isDriver = (m?: Membership) => !!m?.roles.includes("driver");
export const isManager = (m?: Membership) =>
  !!m?.roles.some((r) => ["fleet_admin", "dispatcher", "compliance_officer", "super_admin"].includes(r));
