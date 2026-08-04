-- Add health unit (UBS) free-text field on OS
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS health_unit text;

-- Boletim UBS (header)
CREATE TABLE IF NOT EXISTS public.ubs_bulletins (
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
  ON public.ubs_bulletins FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER ubs_bulletins_updated_at
  BEFORE UPDATE ON public.ubs_bulletins
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Patients within a bulletin
CREATE TABLE IF NOT EXISTS public.ubs_bulletin_patients (
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
  ON public.ubs_bulletin_patients FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ubs_bp_bulletin ON public.ubs_bulletin_patients(bulletin_id);