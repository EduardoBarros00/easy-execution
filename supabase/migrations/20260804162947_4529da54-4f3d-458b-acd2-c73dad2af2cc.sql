CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dentist_name TEXT NOT NULL,
  contractor_name TEXT,
  clinic_name TEXT,
  document TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  credit_limit NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clients_owner_idx ON public.clients(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own clients" ON public.clients FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  specialty TEXT,
  services TEXT,
  document TEXT,
  phone TEXT,
  bank TEXT,
  pix_key TEXT,
  commission_pct NUMERIC(5,2) DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX technicians_owner_idx ON public.technicians(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technicians TO authenticated;
GRANT ALL ON public.technicians TO service_role;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own technicians" ON public.technicians FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.prosthesis_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_price NUMERIC(12,2) DEFAULT 0,
  default_cost NUMERIC(12,2) DEFAULT 0,
  default_commission_pct NUMERIC(5,2) DEFAULT 0,
  avg_days INT DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX prosthesis_types_owner_idx ON public.prosthesis_types(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prosthesis_types TO authenticated;
GRANT ALL ON public.prosthesis_types TO service_role;
ALTER TABLE public.prosthesis_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prosthesis_types" ON public.prosthesis_types FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TYPE public.os_status AS ENUM ('pending','in_progress','delivered','cancelled');

CREATE TABLE public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
  prosthesis_type_id UUID REFERENCES public.prosthesis_types(id) ON DELETE SET NULL,
  contractor_name TEXT,
  dentist_name TEXT,
  sent_at DATE,
  expected_at DATE,
  delivered_at DATE,
  molding_date DATE,
  wax_plan_date DATE,
  teeth_setup_date DATE,
  acrylization_date DATE,
  status public.os_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, code)
);
CREATE INDEX service_orders_owner_idx ON public.service_orders(owner_id);
CREATE INDEX service_orders_status_idx ON public.service_orders(owner_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_orders TO authenticated;
GRANT ALL ON public.service_orders TO service_role;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own service_orders" ON public.service_orders FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.service_order_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  os_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sop_owner_idx ON public.service_order_photos(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_photos TO authenticated;
GRANT ALL ON public.service_order_photos TO service_role;
ALTER TABLE public.service_order_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own os photos" ON public.service_order_photos FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.service_order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  os_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX soh_owner_idx ON public.service_order_history(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_history TO authenticated;
GRANT ALL ON public.service_order_history TO service_role;
ALTER TABLE public.service_order_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own os history" ON public.service_order_history FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TYPE public.fin_kind AS ENUM ('income','expense');
CREATE TYPE public.fin_status AS ENUM ('pending','paid');

CREATE TABLE public.finance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.fin_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fc_owner_idx ON public.finance_categories(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories TO authenticated;
GRANT ALL ON public.finance_categories TO service_role;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fin cats" ON public.finance_categories FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.fin_kind NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category_id UUID REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  os_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL,
  due_date DATE,
  paid_at DATE,
  status public.fin_status NOT NULL DEFAULT 'pending',
  attachment_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fe_owner_idx ON public.finance_entries(owner_id);
CREATE INDEX fe_status_idx ON public.finance_entries(owner_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fin entries" ON public.finance_entries FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER set_updated_at_clients BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_techs BEFORE UPDATE ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_os BEFORE UPDATE ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_fe BEFORE UPDATE ON public.finance_entries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_os_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  y INT := EXTRACT(YEAR FROM now());
  n INT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(code,'-',3) AS INT)),0)+1
    INTO n
    FROM public.service_orders
    WHERE owner_id = NEW.owner_id AND code LIKE 'OS-' || y || '-%';
    NEW.code := 'OS-' || y || '-' || LPAD(n::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER os_code_before_insert BEFORE INSERT ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.tg_os_code();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    (NEW.id, 'Materiais', 'expense'),
    (NEW.id, 'Mão de Obra', 'expense'),
    (NEW.id, 'Aluguel', 'expense'),
    (NEW.id, 'Impostos', 'expense'),
    (NEW.id, 'Outras Despesas', 'expense');

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "own folder read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own folder insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own folder update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own folder delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_os_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  document TEXT,
  contact_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  category TEXT,
  notes TEXT,
  products TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_os_sync_finance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status fin_status;
  v_paid_at date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.finance_entries WHERE os_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.status = 'delivered' THEN
    v_status := 'paid';
    v_paid_at := COALESCE(NEW.delivered_at, CURRENT_DATE);
  ELSE
    v_status := 'pending';
    v_paid_at := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.price, 0) > 0 THEN
      INSERT INTO public.finance_entries (owner_id, os_id, client_id, kind, status, amount, description, due_date, paid_at)
      VALUES (NEW.owner_id, NEW.id, NEW.client_id, 'income', v_status, NEW.price,
              'OS ' || NEW.code || COALESCE(' - ' || NEW.patient_name, ''),
              NEW.expected_at, v_paid_at);
    END IF;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.finance_entries WHERE os_id = NEW.id) THEN
    IF COALESCE(NEW.price, 0) > 0 THEN
      UPDATE public.finance_entries
      SET amount = NEW.price,
          status = v_status,
          paid_at = v_paid_at,
          due_date = NEW.expected_at,
          client_id = NEW.client_id,
          description = 'OS ' || NEW.code || COALESCE(' - ' || NEW.patient_name, ''),
          updated_at = now()
      WHERE os_id = NEW.id;
    ELSE
      DELETE FROM public.finance_entries WHERE os_id = NEW.id;
    END IF;
  ELSIF COALESCE(NEW.price, 0) > 0 THEN
    INSERT INTO public.finance_entries (owner_id, os_id, client_id, kind, status, amount, description, due_date, paid_at)
    VALUES (NEW.owner_id, NEW.id, NEW.client_id, 'income', v_status, NEW.price,
            'OS ' || NEW.code || COALESCE(' - ' || NEW.patient_name, ''),
            NEW.expected_at, v_paid_at);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_orders_sync_finance ON public.service_orders;
CREATE TRIGGER service_orders_sync_finance
AFTER INSERT OR UPDATE OR DELETE ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION public.tg_os_sync_finance();

REVOKE EXECUTE ON FUNCTION public.tg_os_sync_finance() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.dentists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  full_name text NOT NULL,
  cro text,
  specialty text,
  clinic_name text,
  phone text,
  whatsapp text,
  email text,
  document text,
  address text,
  payment_per_service numeric NOT NULL DEFAULT 0,
  commission_pct numeric NOT NULL DEFAULT 0,
  pix_key text,
  bank text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dentists TO authenticated;
GRANT ALL ON public.dentists TO service_role;
ALTER TABLE public.dentists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dentists" ON public.dentists
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER set_dentists_updated_at
  BEFORE UPDATE ON public.dentists
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();