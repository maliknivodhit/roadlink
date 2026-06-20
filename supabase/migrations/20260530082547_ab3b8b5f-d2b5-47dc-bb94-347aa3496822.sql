CREATE POLICY "authenticated create company"
ON public.companies FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);