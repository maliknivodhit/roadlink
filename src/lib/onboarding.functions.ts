import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CreateCompanyInput = z.object({
  name: z.string().trim().min(1, "Company name is required").max(160),
  dotNumber: z.string().trim().max(32).optional(),
  timezone: z.string().trim().min(1).max(64).default("America/Chicago"),
});

export const createCompanyForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateCompanyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: companyId, error } = await supabaseAdmin.rpc("create_company_for_user", {
      _user_id: context.userId,
      _name: data.name,
      _dot_number: data.dotNumber || undefined,
      _timezone: data.timezone,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { companyId: companyId as string };
  });