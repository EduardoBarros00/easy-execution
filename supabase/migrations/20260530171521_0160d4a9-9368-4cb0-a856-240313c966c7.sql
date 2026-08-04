
-- 1. App role enum + user_roles table
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

-- 2. Security definer helpers
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
AS $$ SELECT public.is_admin() OR _city_id = public.get_user_city_id() $$;

-- 3. Add city_id to all data tables
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

-- 4. Backfill: all existing data belongs to Itaitinga
UPDATE public.profiles SET city_id = 'bbb557db-600b-413a-825d-2c3d8b2d2ce8' WHERE id = '10bda9b5-ac65-4a90-b01c-5dec7d8d56a2';
UPDATE public.clients SET city_id = 'bbb557db-600b-413a-825d-2c3d8b2d2ce8' WHERE city_id IS NULL;
UPDATE public.dentists SET city_id = 'bbb557db-600b-413a-825d-2c3d8b2d2ce8' WHERE city_id IS NULL;
UPDATE public.technicians SET city_id = 'bbb557db-600b-413a-825d-2c3d8b2d2ce8' WHERE city_id IS NULL;
UPDATE public.suppliers SET city_id = 'bbb557db-600b-413a-825d-2c3d8b2d2ce8' WHERE city_id IS NULL;
UPDATE public.service_orders SET city_id = 'bbb557db-600b-413a-825d-2c3d8b2d2ce8' WHERE city_id IS NULL;
UPDATE public.os_expenses SET city_id = 'bbb557db-600b-413a-825d-2c3d8b2d2ce8' WHERE city_id IS NULL;
UPDATE public.finance_entries SET city_id = 'bbb557db-600b-413a-825d-2c3d8b2d2ce8' WHERE city_id IS NULL;
UPDATE public.finance_categories SET city_id = 'bbb557db-600b-413a-825d-2c3d8b2d2ce8' WHERE city_id IS NULL;
UPDATE public.prosthesis_types SET city_id = 'bbb557db-600b-413a-825d-2c3d8b2d2ce8' WHERE city_id IS NULL;
UPDATE public.service_order_history SET city_id = 'bbb557db-600b-413a-825d-2c3d8b2d2ce8' WHERE city_id IS NULL;
UPDATE public.service_order_photos SET city_id = 'bbb557db-600b-413a-825d-2c3d8b2d2ce8' WHERE city_id IS NULL;

-- 5. Grant admin role to Pedro
INSERT INTO public.user_roles (user_id, role) VALUES ('10bda9b5-ac65-4a90-b01c-5dec7d8d56a2', 'admin') ON CONFLICT DO NOTHING;

-- 6. Replace RLS policies to scope by city (admin bypasses)
-- Helper macro pattern: drop existing "own X" policy and recreate with city scoping.

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

DROP POLICY IF EXISTS "own os_expenses" ON public.os_expenses;
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

-- Cities: admin sees all; users see only their own city
DROP POLICY IF EXISTS "own cities" ON public.cities;
CREATE POLICY "city scoped cities" ON public.cities FOR ALL TO authenticated
  USING (public.is_admin() OR id = public.get_user_city_id())
  WITH CHECK (public.is_admin() OR id = public.get_user_city_id());

-- 7. Auto-fill city_id trigger on insert for non-admin (use user's profile city)
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
