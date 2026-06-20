
-- Pin search_path on the remaining functions
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.block_hos_log_mutation() SET search_path = public;
ALTER FUNCTION public.block_dot_mutation() SET search_path = public;
ALTER FUNCTION public.block_audit_mutation() SET search_path = public;

-- Revoke anon execute on security-definer helpers (only authenticated needs them)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_company_manager(uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_manager(uuid, uuid) TO authenticated, service_role;
