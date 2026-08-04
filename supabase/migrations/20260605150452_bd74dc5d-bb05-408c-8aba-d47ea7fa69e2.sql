
-- Strict city isolation for ALL users (admins included)
CREATE OR REPLACE FUNCTION public.can_access_city(_city_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT _city_id IS NOT NULL AND _city_id = public.get_user_city_id() $$;
