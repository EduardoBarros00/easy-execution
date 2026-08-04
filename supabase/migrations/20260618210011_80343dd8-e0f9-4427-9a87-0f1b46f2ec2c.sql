
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  document text,
  birth_date date,
  phone text,
  whatsapp text,
  email text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_city_access" ON public.patients
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.can_access_city(city_id))
  WITH CHECK (public.is_admin() OR public.can_access_city(city_id));

CREATE TRIGGER patients_set_city BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_city_id();

CREATE TRIGGER patients_set_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.service_order_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  service_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (os_id, patient_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_patients TO authenticated;
GRANT ALL ON public.service_order_patients TO service_role;

ALTER TABLE public.service_order_patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sop_access_via_os" ON public.service_order_patients
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_orders o WHERE o.id = os_id AND (public.is_admin() OR public.can_access_city(o.city_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_orders o WHERE o.id = os_id AND (public.is_admin() OR public.can_access_city(o.city_id))));

CREATE INDEX idx_sop_os ON public.service_order_patients(os_id);
CREATE INDEX idx_sop_patient ON public.service_order_patients(patient_id);
CREATE INDEX idx_patients_city ON public.patients(city_id);
