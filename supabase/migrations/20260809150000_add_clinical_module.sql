-- Módulo clínico: agenda e prontuário básico.
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  dentist_id uuid REFERENCES public.dentists(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 10 AND 480),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX appointments_owner_schedule_idx ON public.appointments(owner_id, scheduled_at);
CREATE INDEX appointments_patient_idx ON public.appointments(patient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  dentist_id uuid REFERENCES public.dentists(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  record_date date NOT NULL DEFAULT current_date,
  anamnesis text,
  evolution text NOT NULL,
  procedures text,
  recommendations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clinical_notes_owner_patient_idx ON public.clinical_notes(owner_id, patient_id, record_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_notes TO authenticated;
GRANT ALL ON public.clinical_notes TO service_role;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage clinical notes" ON public.clinical_notes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER clinical_notes_set_updated_at
  BEFORE UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
