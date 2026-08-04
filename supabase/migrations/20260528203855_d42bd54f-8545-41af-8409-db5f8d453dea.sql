
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
