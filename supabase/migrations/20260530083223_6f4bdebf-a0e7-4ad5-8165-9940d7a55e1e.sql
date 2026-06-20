DROP POLICY IF EXISTS "users create own initial fleet admin role" ON public.user_roles;
DROP FUNCTION IF EXISTS public.create_company_for_current_user(text, text, text);

CREATE OR REPLACE FUNCTION public.create_company_for_user(
  _user_id uuid,
  _name text,
  _dot_number text DEFAULT NULL,
  _timezone text DEFAULT 'America/Chicago'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _existing_company_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User is required.';
  END IF;

  SELECT company_id
  INTO _existing_company_id
  FROM public.profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;

  IF _existing_company_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a company.';
  END IF;

  IF NULLIF(trim(_name), '') IS NULL THEN
    RAISE EXCEPTION 'Company name is required.';
  END IF;

  INSERT INTO public.companies (name, dot_number, timezone)
  VALUES (trim(_name), NULLIF(trim(_dot_number), ''), COALESCE(NULLIF(trim(_timezone), ''), 'America/Chicago'))
  RETURNING id INTO _company_id;

  UPDATE public.profiles
  SET company_id = _company_id
  WHERE id = _user_id;

  INSERT INTO public.user_roles (user_id, company_id, role, granted_by)
  VALUES (_user_id, _company_id, 'fleet_admin'::public.app_role, _user_id)
  ON CONFLICT (user_id, company_id, role) DO NOTHING;

  RETURN _company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_for_user(uuid, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_for_user(uuid, text, text, text) TO service_role;