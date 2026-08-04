CREATE TABLE public.cities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  uf TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cities TO authenticated;
GRANT SELECT ON public.cities TO anon;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read cities" ON public.cities FOR SELECT TO anon USING (true);
CREATE TRIGGER cities_updated BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.os_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  os_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_expenses TO authenticated;
GRANT ALL ON public.os_expenses TO service_role;
ALTER TABLE public.os_expenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_os_expenses_os ON public.os_expenses(os_id);

ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS city_id UUID;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS health_unit text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_city_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT city_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'admin') $$;

CREATE OR REPLACE FUNCTION public.can_access_city(_city_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT _city_id IS NOT NULL AND _city_id = public.get_user_city_id() $$;

ALTER TABLE public.clients ADD COLUMN city_id uuid;
ALTER TABLE public.dentists ADD COLUMN city_id uuid;
ALTER TABLE public.technicians ADD COLUMN city_id uuid;
ALTER TABLE public.suppliers ADD COLUMN city_id uuid;
ALTER TABLE public.os_expenses ADD COLUMN city_id uuid;
ALTER TABLE public.finance_entries ADD COLUMN city_id uuid;
ALTER TABLE public.finance_categories ADD COLUMN city_id uuid;
ALTER TABLE public.prosthesis_types ADD COLUMN city_id uuid;
ALTER TABLE public.service_order_history ADD COLUMN city_id uuid;
ALTER TABLE public.service_order_photos ADD COLUMN city_id uuid;

DROP POLICY IF EXISTS "own clients" ON public.clients;
CREATE POLICY "city scoped clients" ON public.clients FOR ALL TO authenticated
  USING (public.can_access_city(city_id)) WITH CHECK (public.can_access_city(city_id));

DROP POLICY IF EXISTS "own dentists" ON public.dentists;
CREATE POLICY "city scoped dentists" ON public.dentists FOR ALL TO authenticated
  USING (public.can_access_city(city_id)) WITH CHECK (public.can_access_city(city_id));

DROP POLICY IF EXISTS "own technicians" ON public.technicians;
CREATE POLICY "city scoped technicians" ON public.technicians FOR ALL TO authenticated
  USING (public.can_access_city(city_id)) WITH CHECK (public.can_access_city(city_id));

DROP POLICY IF EXISTS "own suppliers" ON public.suppliers;
CREATE POLICY "city scoped suppliers" ON public.suppliers FOR ALL TO authenticated
  USING (public.can_access_city(city_id)) WITH CHECK (public.can_access_city(city_id));

DROP POLICY IF EXISTS "own service_orders" ON public.service_orders;
CREATE POLICY "city scoped service_orders" ON public.service_orders FOR ALL TO authenticated
  USING (public.can_access_city(city_id)) WITH CHECK (public.can_access_city(city_id));

CREATE POLICY "city scoped os_expenses" ON public.os_expenses FOR ALL TO authenticated
  USING (public.can_access_city(city_id)) WITH CHECK (public.can_access_city(city_id));

DROP POLICY IF EXISTS "own fin entries" ON public.finance_entries;
CREATE POLICY "city scoped finance_entries" ON public.finance_entries FOR ALL TO authenticated
  USING (public.can_access_city(city_id)) WITH CHECK (public.can_access_city(city_id));

DROP POLICY IF EXISTS "own fin cats" ON public.finance_categories;
CREATE POLICY "city scoped finance_categories" ON public.finance_categories FOR ALL TO authenticated
  USING (public.can_access_city(city_id)) WITH CHECK (public.can_access_city(city_id));

DROP POLICY IF EXISTS "own prosthesis_types" ON public.prosthesis_types;
CREATE POLICY "city scoped prosthesis_types" ON public.prosthesis_types FOR ALL TO authenticated
  USING (public.can_access_city(city_id)) WITH CHECK (public.can_access_city(city_id));

DROP POLICY IF EXISTS "own os history" ON public.service_order_history;
CREATE POLICY "city scoped os_history" ON public.service_order_history FOR ALL TO authenticated
  USING (public.can_access_city(city_id)) WITH CHECK (public.can_access_city(city_id));

DROP POLICY IF EXISTS "own os photos" ON public.service_order_photos;
CREATE POLICY "city scoped os_photos" ON public.service_order_photos FOR ALL TO authenticated
  USING (public.can_access_city(city_id)) WITH CHECK (public.can_access_city(city_id));

CREATE POLICY "city scoped cities" ON public.cities FOR ALL TO authenticated
  USING (public.is_admin() OR id = public.get_user_city_id())
  WITH CHECK (public.is_admin() OR id = public.get_user_city_id());

CREATE OR REPLACE FUNCTION public.tg_set_city_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.city_id IS NULL THEN
    NEW.city_id := public.get_user_city_id();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER set_city_id BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.tg_set_city_id();
CREATE TRIGGER set_city_id BEFORE INSERT ON public.dentists FOR EACH ROW EXECUTE FUNCTION public.tg_set_city_id();
CREATE TRIGGER set_city_id BEFORE INSERT ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.tg_set_city_id();
CREATE TRIGGER set_city_id BEFORE INSERT ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_set_city_id();
CREATE TRIGGER set_city_id BEFORE INSERT ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_city_id();
CREATE TRIGGER set_city_id BEFORE INSERT ON public.os_expenses FOR EACH ROW EXECUTE FUNCTION public.tg_set_city_id();
CREATE TRIGGER set_city_id BEFORE INSERT ON public.finance_entries FOR EACH ROW EXECUTE FUNCTION public.tg_set_city_id();
CREATE TRIGGER set_city_id BEFORE INSERT ON public.finance_categories FOR EACH ROW EXECUTE FUNCTION public.tg_set_city_id();
CREATE TRIGGER set_city_id BEFORE INSERT ON public.prosthesis_types FOR EACH ROW EXECUTE FUNCTION public.tg_set_city_id();
CREATE TRIGGER set_city_id BEFORE INSERT ON public.service_order_history FOR EACH ROW EXECUTE FUNCTION public.tg_set_city_id();
CREATE TRIGGER set_city_id BEFORE INSERT ON public.service_order_photos FOR EACH ROW EXECUTE FUNCTION public.tg_set_city_id();

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

CREATE TABLE public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  ip text,
  user_agent text,
  event_type text NOT NULL DEFAULT 'sign_in',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_login_events_select" ON public.login_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "own_login_events_insert" ON public.login_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE INDEX login_events_user_id_idx ON public.login_events(user_id, created_at DESC);
CREATE INDEX login_events_city_id_idx ON public.login_events(city_id, created_at DESC);

CREATE POLICY "admin_select_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "admin_manage_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  INSERT INTO public.prosthesis_types (owner_id, name, default_price, default_cost, default_commission_pct, avg_days) VALUES
    (NEW.id, 'PPR - Prótese Parcial Removível', 0, 0, 0, 10),
    (NEW.id, 'PT - Prótese Total', 0, 0, 0, 10),
    (NEW.id, 'Prótese Fixa', 0, 0, 0, 7),
    (NEW.id, 'Coroa', 0, 0, 0, 5),
    (NEW.id, 'Implante', 0, 0, 0, 14),
    (NEW.id, 'Ortodontia', 0, 0, 0, 7),
    (NEW.id, 'Outros', 0, 0, 0, 5);

  INSERT INTO public.finance_categories (owner_id, name, kind) VALUES
    (NEW.id, 'Serviços de Prótese', 'income'),
    (NEW.id, 'Outras Receitas', 'income'),
    (NEW.id, 'Protético', 'expense'),
    (NEW.id, 'Dentista', 'expense'),
    (NEW.id, 'Gasolina', 'expense'),
    (NEW.id, 'Alimentação', 'expense'),
    (NEW.id, 'Material', 'expense'),
    (NEW.id, 'Manutenção', 'expense'),
    (NEW.id, 'Aluguel', 'expense'),
    (NEW.id, 'Impostos', 'expense'),
    (NEW.id, 'Outras Despesas', 'expense');

  RETURN NEW;
END $function$;

CREATE TABLE public.ubs_bulletins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  health_unit text NOT NULL,
  professional_name text NOT NULL,
  specialty text,
  bulletin_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ubs_bulletins TO authenticated;
GRANT ALL ON public.ubs_bulletins TO service_role;
ALTER TABLE public.ubs_bulletins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages bulletins"
  ON public.ubs_bulletins FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER ubs_bulletins_updated_at
  BEFORE UPDATE ON public.ubs_bulletins
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.ubs_bulletin_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_id uuid NOT NULL REFERENCES public.ubs_bulletins(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 1,
  patient_name text NOT NULL,
  birth_date date,
  age int,
  sex text,
  address text,
  cns text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ubs_bulletin_patients TO authenticated;
GRANT ALL ON public.ubs_bulletin_patients TO service_role;
ALTER TABLE public.ubs_bulletin_patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages bulletin patients"
  ON public.ubs_bulletin_patients FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
CREATE INDEX idx_ubs_bp_bulletin ON public.ubs_bulletin_patients(bulletin_id);