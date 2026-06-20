// Invite a member to a company.
// - If a user already exists with that email, they are immediately added to the company and granted the role.
// - Otherwise, an invitation is sent and pre-provisioned with company_id + role (applied on signup via webhook flow).
//
// POST { email, role, company_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ALLOWED_ROLES = ["fleet_admin", "dispatcher", "compliance_officer", "driver", "mechanic"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { email, role, company_id } = body ?? {};
    if (!email || !role || !company_id) return json({ error: "email, role, company_id required" }, 400);
    if (!ALLOWED_ROLES.includes(role)) return json({ error: "invalid role" }, 400);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    // Verify caller is a manager of this company
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "unauthorized" }, 401);
    const { data: isMgr } = await userClient.rpc("is_company_manager", { _user_id: user.id, _company_id: company_id });
    if (!isMgr) return json({ error: "forbidden" }, 403);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Does the user already exist?
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    let userId: string | null = null;
    // listUsers can't filter by email server-side in v2; do a manual lookup via profiles.
    const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (profile) {
      userId = profile.id;
      await admin.from("profiles").update({ company_id }).eq("id", userId);
    } else {
      const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { invited_company_id: company_id, invited_role: role },
      });
      if (invErr) return json({ error: invErr.message }, 400);
      userId = invited.user?.id ?? null;
      if (userId) {
        // Wait for the auth trigger to create the profile, then patch company_id
        await new Promise((r) => setTimeout(r, 400));
        await admin.from("profiles").update({ company_id }).eq("id", userId);
      }
    }

    if (userId) {
      await admin.from("user_roles").upsert(
        { user_id: userId, company_id, role, granted_by: user.id },
        { onConflict: "user_id,company_id,role" },
      );
      if (role === "driver") {
        await admin.from("drivers").upsert({ id: userId, company_id }, { onConflict: "id" });
      }
    }

    return json({ ok: true, user_id: userId, existing: !!profile });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
