
-- 1. Adicionar coluna 'active' em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 2. Tornar Pedro admin global
INSERT INTO public.user_roles (user_id, role)
VALUES ('10bda9b5-ac65-4a90-b01c-5dec7d8d56a2', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Tabela de eventos de login (IP, user agent, device)
CREATE TABLE IF NOT EXISTS public.login_events (
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

-- Usuário vê seus próprios eventos; admin vê tudo
CREATE POLICY "own_login_events_select" ON public.login_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "own_login_events_insert" ON public.login_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS login_events_user_id_idx ON public.login_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS login_events_city_id_idx ON public.login_events(city_id, created_at DESC);

-- 4. Admin pode ler e atualizar todos os profiles (ativar/desativar usuário)
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.profiles;
CREATE POLICY "admin_select_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. Admin pode gerenciar user_roles
DROP POLICY IF EXISTS "admin_manage_roles" ON public.user_roles;
CREATE POLICY "admin_manage_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
