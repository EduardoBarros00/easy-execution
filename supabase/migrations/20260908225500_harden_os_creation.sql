-- Harden OS creation/editing across cities without weakening common-user isolation.

-- Admins need to read dentists across cities in the OS form.
DROP POLICY IF EXISTS "admins read all dentists" ON public.dentists;
CREATE POLICY "admins read all dentists"
ON public.dentists
FOR SELECT
TO authenticated
USING ((SELECT public.is_admin()));

-- Explicit admin write policies. Existing city-scoped policies remain in place for non-admin users.
DROP POLICY IF EXISTS "admins insert service_orders" ON public.service_orders;
CREATE POLICY "admins insert service_orders"
ON public.service_orders
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admins update service_orders" ON public.service_orders;
CREATE POLICY "admins update service_orders"
ON public.service_orders
FOR UPDATE
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admins delete service_orders" ON public.service_orders;
CREATE POLICY "admins delete service_orders"
ON public.service_orders
FOR DELETE
TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admins insert os_expenses" ON public.os_expenses;
CREATE POLICY "admins insert os_expenses"
ON public.os_expenses
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admins update os_expenses" ON public.os_expenses;
CREATE POLICY "admins update os_expenses"
ON public.os_expenses
FOR UPDATE
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admins delete os_expenses" ON public.os_expenses;
CREATE POLICY "admins delete os_expenses"
ON public.os_expenses
FOR DELETE
TO authenticated
USING ((SELECT public.is_admin()));

-- Replace all expenses for one OS atomically. SECURITY INVOKER keeps RLS active.
CREATE OR REPLACE FUNCTION public.replace_os_expenses(
  p_os_id uuid,
  p_city_id uuid,
  p_expenses jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_description text;
  v_amount numeric;
BEGIN
  IF p_os_id IS NULL OR p_city_id IS NULL THEN
    RAISE EXCEPTION 'OS e cidade são obrigatórias';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.service_orders
    WHERE id = p_os_id
      AND city_id = p_city_id
  ) THEN
    RAISE EXCEPTION 'OS não encontrada na cidade informada';
  END IF;

  IF jsonb_typeof(COALESCE(p_expenses, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Lista de gastos inválida';
  END IF;

  -- Validate everything before deleting current rows.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_expenses, '[]'::jsonb))
  LOOP
    v_description := btrim(COALESCE(v_item->>'description', ''));
    BEGIN
      v_amount := (v_item->>'amount')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Valor de gasto inválido';
    END;

    IF v_description = '' THEN
      RAISE EXCEPTION 'Descrição do gasto é obrigatória';
    END IF;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'O valor do gasto deve ser maior que zero';
    END IF;
  END LOOP;

  DELETE FROM public.os_expenses WHERE os_id = p_os_id;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_expenses, '[]'::jsonb))
  LOOP
    INSERT INTO public.os_expenses (
      owner_id,
      os_id,
      city_id,
      description,
      amount
    ) VALUES (
      auth.uid(),
      p_os_id,
      p_city_id,
      btrim(v_item->>'description'),
      (v_item->>'amount')::numeric
    );
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_os_expenses(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_os_expenses(uuid, uuid, jsonb) TO authenticated;
