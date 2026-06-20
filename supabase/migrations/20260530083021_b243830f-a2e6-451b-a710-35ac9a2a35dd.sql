CREATE POLICY "users create own initial fleet admin role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'fleet_admin'::public.app_role
  AND company_id IS NOT NULL
  AND public.get_user_company_id(auth.uid()) = company_id
);

CREATE OR REPLACE FUNCTION public.create_company_for_current_user(
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
  _user_id uuid := auth.uid();
  _company_id uuid;
  _existing_company_id uuid;
  _email text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT company_id, email
  INTO _existing_company_id, _email
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

REVOKE ALL ON FUNCTION public.create_company_for_current_user(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_company_for_current_user(text, text, text) TO authenticated, service_role;