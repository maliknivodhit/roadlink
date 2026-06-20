
-- Relax manager_edit_hos_log: allow editing any event from the last 7 days to any status.
CREATE OR REPLACE FUNCTION public.manager_edit_hos_log(_log_id uuid, _new_duty_status duty_status, _new_event_time timestamp with time zone, _new_notes text, _reason text)
 RETURNS hos_logs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _orig public.hos_logs;
  _updated public.hos_logs;
BEGIN
  SELECT * INTO _orig FROM public.hos_logs WHERE id = _log_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Log not found'; END IF;

  IF NOT public.is_company_manager(auth.uid(), _orig.company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _orig.event_time < (now() - interval '7 days') THEN
    RAISE EXCEPTION 'Events older than 7 days cannot be edited';
  END IF;

  INSERT INTO public.hos_log_edits (company_id, original_log_id, proposed_by, reason, proposed_changes, status, resolved_at)
  VALUES (_orig.company_id, _orig.id, auth.uid(), COALESCE(_reason,'manager edit'),
          jsonb_build_object(
            'from', jsonb_build_object('duty_status', _orig.duty_status, 'event_time', _orig.event_time, 'notes', _orig.notes),
            'to',   jsonb_build_object('duty_status', _new_duty_status, 'event_time', _new_event_time, 'notes', _new_notes)
          ),
          'applied', now());

  SET LOCAL session_replication_role = replica;
  UPDATE public.hos_logs
     SET duty_status = _new_duty_status,
         event_time  = _new_event_time,
         notes       = _new_notes
   WHERE id = _log_id
   RETURNING * INTO _updated;
  SET LOCAL session_replication_role = origin;

  RETURN _updated;
END;
$function$;

-- Trip documents table: drivers record start/destination/shipping info per trip.
CREATE TABLE public.trip_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  trip_date date NOT NULL DEFAULT (now()::date),
  start_location text,
  destination text,
  shipping_number text,
  trailer_number text,
  load_description text,
  bol_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_documents TO authenticated;
GRANT ALL ON public.trip_documents TO service_role;

ALTER TABLE public.trip_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver manages own trip docs"
  ON public.trip_documents FOR ALL
  TO authenticated
  USING (driver_id = auth.uid() OR public.is_company_manager(auth.uid(), company_id))
  WITH CHECK (
    (driver_id = auth.uid() AND company_id = public.get_user_company_id(auth.uid()))
    OR public.is_company_manager(auth.uid(), company_id)
  );

CREATE INDEX idx_trip_documents_driver_date ON public.trip_documents(driver_id, trip_date DESC);
CREATE INDEX idx_trip_documents_company_date ON public.trip_documents(company_id, trip_date DESC);

CREATE TRIGGER trip_documents_touch_updated_at
  BEFORE UPDATE ON public.trip_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
