import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CreateDriverInput = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(1).max(160),
  employeeId: z.string().trim().max(64).optional().or(z.literal("")),
  cdlNumber: z.string().trim().max(64).optional().or(z.literal("")),
  cdlState: z.string().trim().max(2).optional().or(z.literal("")),
  cdlClass: z.string().trim().max(8).optional().or(z.literal("")),
  cdlExpires: z.string().trim().optional().or(z.literal("")),
  medicalCardExpires: z.string().trim().optional().or(z.literal("")),
  vehicleId: z.string().uuid().optional().or(z.literal("")),
  hosCycle: z.enum(["us_70_8", "us_60_7", "canada_70_7", "canada_120_14"]).default("us_70_8"),
});

export const createDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateDriverInput.parse(input))
  .handler(async ({ data, context }) => {
    // Verify caller's company + manager status
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    const companyId = profile?.company_id;
    if (!companyId) throw new Error("You must belong to a company before adding drivers.");

    const { data: isMgr, error: rErr } = await supabaseAdmin.rpc("is_company_manager", {
      _user_id: context.userId,
      _company_id: companyId,
    });
    if (rErr) throw new Error(rErr.message);
    if (!isMgr) throw new Error("Only managers can add drivers.");

    // Create auth user (auto-confirmed so they can log in immediately)
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Failed to create user");
    const userId = created.user.id;

    // Wait briefly for handle_new_user trigger to create profile, then patch it
    await new Promise((r) => setTimeout(r, 300));
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: userId, email: data.email, full_name: data.fullName, company_id: companyId },
        { onConflict: "id" },
      );
    if (upErr) throw new Error(upErr.message);

    // Driver role
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, company_id: companyId, role: "driver", granted_by: context.userId },
        { onConflict: "user_id,company_id,role" },
      );
    if (roleErr) throw new Error(roleErr.message);

    // Drivers row
    const { error: dErr } = await supabaseAdmin.from("drivers").upsert(
      {
        id: userId,
        company_id: companyId,
        employee_id: data.employeeId || null,
        cdl_number: data.cdlNumber || null,
        cdl_state: data.cdlState ? data.cdlState.toUpperCase() : null,
        cdl_class: data.cdlClass || null,
        cdl_expires: data.cdlExpires || null,
        medical_card_expires: data.medicalCardExpires || null,
        current_vehicle_id: data.vehicleId || null,
        hos_cycle: data.hosCycle,
      },
      { onConflict: "id" },
    );
    if (dErr) throw new Error(dErr.message);

    return { userId };
  });
