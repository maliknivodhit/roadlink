
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM (
  'super_admin','fleet_admin','dispatcher','compliance_officer','driver','mechanic'
);

CREATE TYPE public.duty_status AS ENUM (
  'off_duty','sleeper_berth','driving','on_duty_not_driving',
  'yard_move','personal_conveyance'
);

CREATE TYPE public.hos_cycle AS ENUM ('us_70_8','us_60_7','canada_70_7','canada_120_14');

CREATE TYPE public.vehicle_status AS ENUM ('active','maintenance','out_of_service','retired');

CREATE TYPE public.dvir_type AS ENUM ('pre_trip','post_trip');
CREATE TYPE public.dvir_severity AS ENUM ('minor','major','out_of_service');
CREATE TYPE public.dvir_status AS ENUM ('open','in_repair','resolved','deferred');

CREATE TYPE public.alert_severity AS ENUM ('info','warning','critical');
CREATE TYPE public.alert_category AS ENUM (
  'hos_violation','speeding','geofence','dvir_defect','idle','unidentified_driving',
  'device_offline','document_expiring','harsh_event','other'
);

CREATE TYPE public.eld_event_origin AS ENUM ('auto','driver','co_driver','edit_request','unidentified');

-- =========================================================
-- COMPANIES (tenants)
-- =========================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  dot_number TEXT UNIQUE,
  mc_number TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  address JSONB,
  default_hos_cycle public.hos_cycle NOT NULL DEFAULT 'us_70_8',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PROFILES (1:1 with auth.users, mapped to a company)
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_company ON public.profiles(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER ROLES (RBAC, separate table to prevent privilege escalation)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_company ON public.user_roles(company_id);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SECURITY DEFINER HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_company_manager(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role IN ('fleet_admin','dispatcher','compliance_officer')
  ) OR public.is_super_admin(_user_id)
$$;

-- =========================================================
-- COMPANIES RLS
-- =========================================================
CREATE POLICY "members read own company" ON public.companies FOR SELECT TO authenticated
USING (id = public.get_user_company_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "fleet admins update own company" ON public.companies FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'fleet_admin') AND id = public.get_user_company_id(auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'fleet_admin') AND id = public.get_user_company_id(auth.uid()));

CREATE POLICY "super admins all companies" ON public.companies FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- =========================================================
-- PROFILES RLS
-- =========================================================
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR company_id = public.get_user_company_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "fleet admin manage company profiles" ON public.profiles FOR ALL TO authenticated
USING (public.is_company_manager(auth.uid(), company_id))
WITH CHECK (public.is_company_manager(auth.uid(), company_id));

CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- =========================================================
-- USER ROLES RLS
-- =========================================================
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_company_manager(auth.uid(), company_id));

-- Only super_admin or fleet_admin (via edge function with service role) should grant roles.
CREATE POLICY "fleet admin manage roles in own company" ON public.user_roles FOR ALL TO authenticated
USING (public.is_company_manager(auth.uid(), company_id) AND role <> 'super_admin')
WITH CHECK (public.is_company_manager(auth.uid(), company_id) AND role <> 'super_admin');

-- =========================================================
-- AUTO PROFILE TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- VEHICLES
-- =========================================================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  vin TEXT,
  make TEXT, model TEXT, year INT,
  license_plate TEXT, license_state TEXT,
  status public.vehicle_status NOT NULL DEFAULT 'active',
  fuel_type TEXT,
  odometer_km NUMERIC(12,2) DEFAULT 0,
  engine_hours NUMERIC(10,2) DEFAULT 0,
  registration_expires DATE,
  insurance_expires DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, unit_number)
);
CREATE INDEX idx_vehicles_company ON public.vehicles(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "company reads vehicles" ON public.vehicles FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "managers manage vehicles" ON public.vehicles FOR ALL TO authenticated
USING (public.is_company_manager(auth.uid(), company_id))
WITH CHECK (public.is_company_manager(auth.uid(), company_id));

-- =========================================================
-- ELD DEVICES
-- =========================================================
CREATE TABLE public.eld_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  serial_number TEXT NOT NULL,
  model TEXT,
  firmware_version TEXT,
  last_seen_at TIMESTAMPTZ,
  is_online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, serial_number)
);
CREATE INDEX idx_eld_devices_company ON public.eld_devices(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eld_devices TO authenticated;
GRANT ALL ON public.eld_devices TO service_role;
ALTER TABLE public.eld_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company reads devices" ON public.eld_devices FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "managers manage devices" ON public.eld_devices FOR ALL TO authenticated
USING (public.is_company_manager(auth.uid(), company_id))
WITH CHECK (public.is_company_manager(auth.uid(), company_id));

-- =========================================================
-- DRIVERS (extends profile with CDL info)
-- =========================================================
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id TEXT,
  cdl_number TEXT,
  cdl_state TEXT,
  cdl_class TEXT,
  cdl_expires DATE,
  medical_card_expires DATE,
  hos_cycle public.hos_cycle NOT NULL DEFAULT 'us_70_8',
  home_terminal_timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  exempt_driver BOOLEAN NOT NULL DEFAULT false,
  current_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  current_duty_status public.duty_status NOT NULL DEFAULT 'off_duty',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_drivers_company ON public.drivers(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "driver reads self" ON public.drivers FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_company_manager(auth.uid(), company_id));
CREATE POLICY "driver updates self limited" ON public.drivers FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "managers manage drivers" ON public.drivers FOR ALL TO authenticated
USING (public.is_company_manager(auth.uid(), company_id))
WITH CHECK (public.is_company_manager(auth.uid(), company_id));

-- =========================================================
-- HOS LOGS (immutable event stream per FMCSA 49 CFR Part 395)
-- =========================================================
CREATE TABLE public.hos_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  co_driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  event_time TIMESTAMPTZ NOT NULL,
  duty_status public.duty_status NOT NULL,
  origin public.eld_event_origin NOT NULL DEFAULT 'driver',
  location_text TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  odometer_km NUMERIC(12,2),
  engine_hours NUMERIC(10,2),
  notes TEXT,
  shipping_doc TEXT,
  trailer_ids TEXT[],
  sequence_id BIGSERIAL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hos_logs_driver_time ON public.hos_logs(driver_id, event_time DESC);
CREATE INDEX idx_hos_logs_company_time ON public.hos_logs(company_id, event_time DESC);
GRANT SELECT, INSERT ON public.hos_logs TO authenticated;
GRANT ALL ON public.hos_logs TO service_role;
ALTER TABLE public.hos_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver reads own logs" ON public.hos_logs FOR SELECT TO authenticated
USING (driver_id = auth.uid() OR public.is_company_manager(auth.uid(), company_id));
CREATE POLICY "driver inserts own logs" ON public.hos_logs FOR INSERT TO authenticated
WITH CHECK (driver_id = auth.uid() AND company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "managers insert logs" ON public.hos_logs FOR INSERT TO authenticated
WITH CHECK (public.is_company_manager(auth.uid(), company_id));

-- block updates and deletes — logs are immutable; edits go through hos_log_edits
CREATE OR REPLACE FUNCTION public.block_hos_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'HOS logs are immutable. Submit a record via hos_log_edits.'; END;
$$;
CREATE TRIGGER trg_block_hos_update BEFORE UPDATE ON public.hos_logs
FOR EACH ROW EXECUTE FUNCTION public.block_hos_log_mutation();
CREATE TRIGGER trg_block_hos_delete BEFORE DELETE ON public.hos_logs
FOR EACH ROW EXECUTE FUNCTION public.block_hos_log_mutation();

-- HOS log edit requests (audit trail of proposed corrections)
CREATE TABLE public.hos_log_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  original_log_id UUID NOT NULL REFERENCES public.hos_logs(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  proposed_changes JSONB NOT NULL,
  driver_response TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hos_edits_company ON public.hos_log_edits(company_id);
GRANT SELECT, INSERT, UPDATE ON public.hos_log_edits TO authenticated;
GRANT ALL ON public.hos_log_edits TO service_role;
ALTER TABLE public.hos_log_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edits visible to driver and managers" ON public.hos_log_edits FOR SELECT TO authenticated
USING (
  public.is_company_manager(auth.uid(), company_id)
  OR EXISTS (SELECT 1 FROM public.hos_logs l WHERE l.id = original_log_id AND l.driver_id = auth.uid())
);
CREATE POLICY "managers propose edits" ON public.hos_log_edits FOR INSERT TO authenticated
WITH CHECK (public.is_company_manager(auth.uid(), company_id) AND proposed_by = auth.uid());
CREATE POLICY "driver responds to edits" ON public.hos_log_edits FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.hos_logs l WHERE l.id = original_log_id AND l.driver_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.hos_logs l WHERE l.id = original_log_id AND l.driver_id = auth.uid()));

-- =========================================================
-- GPS PINGS (high-volume time series)
-- =========================================================
CREATE TABLE public.gps_pings (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  speed_kph NUMERIC(6,2),
  heading_deg NUMERIC(5,2),
  odometer_km NUMERIC(12,2),
  engine_on BOOLEAN,
  ignition BOOLEAN
);
CREATE INDEX idx_gps_pings_vehicle_time ON public.gps_pings(vehicle_id, recorded_at DESC);
CREATE INDEX idx_gps_pings_company_time ON public.gps_pings(company_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.gps_pings TO authenticated;
GRANT ALL ON public.gps_pings TO service_role;
ALTER TABLE public.gps_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company reads gps" ON public.gps_pings FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "company inserts gps" ON public.gps_pings FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- =========================================================
-- GEOFENCES
-- =========================================================
CREATE TABLE public.geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  shape_type TEXT NOT NULL DEFAULT 'circle', -- circle | polygon
  center_lat NUMERIC(9,6),
  center_lng NUMERIC(9,6),
  radius_m NUMERIC(10,2),
  polygon JSONB,
  alert_on_enter BOOLEAN NOT NULL DEFAULT true,
  alert_on_exit BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_geofences_company ON public.geofences(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofences TO authenticated;
GRANT ALL ON public.geofences TO service_role;
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company reads geofences" ON public.geofences FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "managers manage geofences" ON public.geofences FOR ALL TO authenticated
USING (public.is_company_manager(auth.uid(), company_id))
WITH CHECK (public.is_company_manager(auth.uid(), company_id));

-- =========================================================
-- DVIR
-- =========================================================
CREATE TABLE public.dvir_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  trailer_ids TEXT[],
  inspection_type public.dvir_type NOT NULL,
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  odometer_km NUMERIC(12,2),
  safe_to_operate BOOLEAN NOT NULL DEFAULT true,
  signature_url TEXT,
  mechanic_signature_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dvir_company ON public.dvir_reports(company_id);
CREATE INDEX idx_dvir_vehicle ON public.dvir_reports(vehicle_id, inspected_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.dvir_reports TO authenticated;
GRANT ALL ON public.dvir_reports TO service_role;
ALTER TABLE public.dvir_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver reads own dvir" ON public.dvir_reports FOR SELECT TO authenticated
USING (driver_id = auth.uid() OR public.is_company_manager(auth.uid(), company_id));
CREATE POLICY "driver creates dvir" ON public.dvir_reports FOR INSERT TO authenticated
WITH CHECK (driver_id = auth.uid() AND company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "managers update dvir" ON public.dvir_reports FOR UPDATE TO authenticated
USING (public.is_company_manager(auth.uid(), company_id))
WITH CHECK (public.is_company_manager(auth.uid(), company_id));

CREATE TABLE public.dvir_defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.dvir_reports(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  component TEXT NOT NULL,
  description TEXT NOT NULL,
  severity public.dvir_severity NOT NULL DEFAULT 'minor',
  status public.dvir_status NOT NULL DEFAULT 'open',
  photo_urls TEXT[],
  repair_notes TEXT,
  repaired_by UUID REFERENCES auth.users(id),
  repaired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dvir_defects_company ON public.dvir_defects(company_id);
GRANT SELECT, INSERT, UPDATE ON public.dvir_defects TO authenticated;
GRANT ALL ON public.dvir_defects TO service_role;
ALTER TABLE public.dvir_defects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company reads defects" ON public.dvir_defects FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "driver and mechanic write defects" ON public.dvir_defects FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "mechanic and managers update defects" ON public.dvir_defects FOR UPDATE TO authenticated
USING (public.is_company_manager(auth.uid(), company_id) OR public.has_role(auth.uid(),'mechanic'))
WITH CHECK (public.is_company_manager(auth.uid(), company_id) OR public.has_role(auth.uid(),'mechanic'));

-- =========================================================
-- IFTA
-- =========================================================
CREATE TABLE public.ifta_fuel_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  purchased_at TIMESTAMPTZ NOT NULL,
  jurisdiction TEXT NOT NULL,
  gallons NUMERIC(10,3) NOT NULL,
  price_per_gallon NUMERIC(10,4),
  total_amount NUMERIC(12,2),
  vendor TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ifta_fuel_company ON public.ifta_fuel_purchases(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifta_fuel_purchases TO authenticated;
GRANT ALL ON public.ifta_fuel_purchases TO service_role;
ALTER TABLE public.ifta_fuel_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company reads ifta fuel" ON public.ifta_fuel_purchases FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "driver writes own fuel" ON public.ifta_fuel_purchases FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "managers manage fuel" ON public.ifta_fuel_purchases FOR ALL TO authenticated
USING (public.is_company_manager(auth.uid(), company_id))
WITH CHECK (public.is_company_manager(auth.uid(), company_id));

CREATE TABLE public.ifta_trip_miles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL,
  trip_date DATE NOT NULL,
  miles NUMERIC(12,2) NOT NULL,
  taxable_miles NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ifta_miles_company ON public.ifta_trip_miles(company_id, trip_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifta_trip_miles TO authenticated;
GRANT ALL ON public.ifta_trip_miles TO service_role;
ALTER TABLE public.ifta_trip_miles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company reads ifta miles" ON public.ifta_trip_miles FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "managers manage miles" ON public.ifta_trip_miles FOR ALL TO authenticated
USING (public.is_company_manager(auth.uid(), company_id))
WITH CHECK (public.is_company_manager(auth.uid(), company_id));

-- =========================================================
-- DOT ROADSIDE INSPECTION TRANSFERS (immutable record)
-- =========================================================
CREATE TABLE public.dot_inspection_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id),
  transfer_method TEXT NOT NULL, -- email | web_services | display | usb | bluetooth
  output_file_format TEXT NOT NULL DEFAULT 'csv',
  output_file_url TEXT,
  output_comment TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  recipient TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dot_company ON public.dot_inspection_transfers(company_id);
GRANT SELECT, INSERT ON public.dot_inspection_transfers TO authenticated;
GRANT ALL ON public.dot_inspection_transfers TO service_role;
ALTER TABLE public.dot_inspection_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company reads dot" ON public.dot_inspection_transfers FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "driver and managers create dot" ON public.dot_inspection_transfers FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND (driver_id = auth.uid() OR public.is_company_manager(auth.uid(), company_id))
);
CREATE OR REPLACE FUNCTION public.block_dot_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'DOT transfer records are immutable.'; END;
$$;
CREATE TRIGGER trg_block_dot_update BEFORE UPDATE ON public.dot_inspection_transfers
FOR EACH ROW EXECUTE FUNCTION public.block_dot_mutation();
CREATE TRIGGER trg_block_dot_delete BEFORE DELETE ON public.dot_inspection_transfers
FOR EACH ROW EXECUTE FUNCTION public.block_dot_mutation();

-- =========================================================
-- ALERTS
-- =========================================================
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  category public.alert_category NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  context JSONB,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_company_created ON public.alerts(company_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company reads alerts" ON public.alerts FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "company inserts alerts" ON public.alerts FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "company updates alerts" ON public.alerts FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()))
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- =========================================================
-- MESSAGES (dispatcher <-> driver)
-- =========================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  attachment_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_company ON public.messages(company_id, created_at DESC);
CREATE INDEX idx_messages_to ON public.messages(to_user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read" ON public.messages FOR SELECT TO authenticated
USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY "sender writes" ON public.messages FOR INSERT TO authenticated
WITH CHECK (from_user_id = auth.uid() AND company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "recipient marks read" ON public.messages FOR UPDATE TO authenticated
USING (to_user_id = auth.uid()) WITH CHECK (to_user_id = auth.uid());

-- =========================================================
-- UNIDENTIFIED DRIVING EVENTS
-- =========================================================
CREATE TABLE public.unidentified_driving_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  distance_km NUMERIC(10,2),
  duration_seconds INT,
  start_location TEXT,
  end_location TEXT,
  claimed_by_driver UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  annotated_by UUID REFERENCES auth.users(id),
  annotation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_unid_company ON public.unidentified_driving_events(company_id, start_time DESC);
GRANT SELECT, INSERT, UPDATE ON public.unidentified_driving_events TO authenticated;
GRANT ALL ON public.unidentified_driving_events TO service_role;
ALTER TABLE public.unidentified_driving_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company reads unid" ON public.unidentified_driving_events FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "company writes unid" ON public.unidentified_driving_events FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "company updates unid" ON public.unidentified_driving_events FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()))
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- =========================================================
-- AUDIT LOG (append only)
-- =========================================================
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_data JSONB,
  after_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_company_time ON public.audit_log(company_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers read audit" ON public.audit_log FOR SELECT TO authenticated
USING (public.is_company_manager(auth.uid(), company_id));
CREATE POLICY "authenticated writes audit" ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());
CREATE OR REPLACE FUNCTION public.block_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit log is append-only.'; END;
$$;
CREATE TRIGGER trg_block_audit_update BEFORE UPDATE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();
CREATE TRIGGER trg_block_audit_delete BEFORE DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

-- =========================================================
-- REALTIME
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.gps_pings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hos_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
