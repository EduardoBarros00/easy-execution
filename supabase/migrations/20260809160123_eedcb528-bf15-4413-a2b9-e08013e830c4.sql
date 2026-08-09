-- 1) Lock down SECURITY DEFINER functions
-- Trigger + internal helpers: not callable via the API at all
REVOKE ALL ON FUNCTION public.attach_user_to_city(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_bootstrap_city_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_os_apply_type_defaults() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_os_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_os_sync_finance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_city_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- Helpers used inside RLS policies: signed-in users only (needed for policy evaluation)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_city_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_access_city(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_city_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_city(uuid) TO authenticated;

-- RPCs intentionally callable by signed-in users only
REVOKE ALL ON FUNCTION public.bootstrap_city(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_my_city(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_city(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_city(uuid) TO authenticated;

-- 2) Remove the race-prone bootstrap INSERT policy on cities.
-- First-city creation now goes exclusively through public.bootstrap_city(),
-- which serializes the check with an advisory lock.
DROP POLICY IF EXISTS "authenticated bootstrap city insert" ON public.cities;

CREATE POLICY "admins insert cities"
ON public.cities
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() AND owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.bootstrap_city(_name text, _uf text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_city_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if coalesce(trim(_name), '') = '' then
    raise exception 'Informe o nome da cidade';
  end if;

  if length(trim(coalesce(_uf, ''))) <> 2 then
    raise exception 'Informe uma UF válida';
  end if;

  -- Serializa concorrência: apenas uma transação por vez executa o bootstrap
  perform pg_advisory_xact_lock(hashtext('public.bootstrap_city'));

  if exists (select 1 from public.cities) and not public.is_admin() then
    raise exception 'A primeira cidade já foi cadastrada';
  end if;

  insert into public.cities (owner_id, name, uf)
  values (v_user_id, trim(_name), upper(trim(_uf)))
  returning id into v_city_id;

  perform public.attach_user_to_city(v_user_id, v_city_id);
  insert into public.user_roles (user_id, role)
  values (v_user_id, 'admin')
  on conflict (user_id, role) do nothing;

  return v_city_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.bootstrap_city(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_city(text, text) TO authenticated;

-- 3) service_order_patients: also verify the patient row is city-accessible
DROP POLICY IF EXISTS "sop_access_via_os" ON public.service_order_patients;

CREATE POLICY "sop_access_via_os_and_patient"
ON public.service_order_patients
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.service_orders o
    WHERE o.id = service_order_patients.os_id
      AND (public.is_admin() OR public.can_access_city(o.city_id))
  )
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = service_order_patients.patient_id
      AND (public.is_admin() OR public.can_access_city(p.city_id))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.service_orders o
    WHERE o.id = service_order_patients.os_id
      AND (public.is_admin() OR public.can_access_city(o.city_id))
  )
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = service_order_patients.patient_id
      AND (public.is_admin() OR public.can_access_city(p.city_id))
  )
);