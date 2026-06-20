-- Manager function to edit HOS logs with audit, bypassing immutability trigger.
CREATE OR REPLACE FUNCTION public.manager_edit_hos_log(
  _log_id uuid,
  _new_duty_status duty_status,
  _new_event_time timestamptz,
  _new_notes text,
  _reason text
) RETURNS public.hos_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _orig public.hos_logs;
  _updated public.hos_logs;
  _driving_set duty_status[] := ARRAY['driving','yard_move','personal_conveyance']::duty_status[];
BEGIN
  SELECT * INTO _orig FROM public.hos_logs WHERE id = _log_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Log not found'; END IF;

  IF NOT public.is_company_manager(auth.uid(), _orig.company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- If original was driving-type, new must also be driving-type
  IF _orig.duty_status = ANY(_driving_set) AND NOT (_new_duty_status = ANY(_driving_set)) THEN
    RAISE EXCEPTION 'Driving events can only be reclassified among driving, yard_move, or personal_conveyance';
  END IF;

  -- Audit record
  INSERT INTO public.hos_log_edits (company_id, original_log_id, proposed_by, reason, proposed_changes, status, resolved_at)
  VALUES (_orig.company_id, _orig.id, auth.uid(), COALESCE(_reason,'manager edit'),
          jsonb_build_object(
            'from', jsonb_build_object('duty_status', _orig.duty_status, 'event_time', _orig.event_time, 'notes', _orig.notes),
            'to',   jsonb_build_object('duty_status', _new_duty_status, 'event_time', _new_event_time, 'notes', _new_notes)
          ),
          'applied', now());

  -- Bypass immutability trigger for this transaction
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
$$;

GRANT EXECUTE ON FUNCTION public.manager_edit_hos_log(uuid, duty_status, timestamptz, text, text) TO authenticated;