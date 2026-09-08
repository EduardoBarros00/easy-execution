-- Corrige a regra de PT/PPR: os valores por cidade são unitários por prótese.
-- Superior + inferior representam 2 próteses e, portanto, 2x o valor unitário.
-- Mudança aditiva e restrita ao LabProt.

CREATE OR REPLACE FUNCTION public.tg_apply_city_service_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $function$
DECLARE
  v_type_name text;
  v_service_code text;
  v_price numeric(12,2);
  v_units integer := 1;
  v_service_text text := upper(trim(coalesce(NEW.service_type, '')));
BEGIN
  -- Preço manual não-zero continua prevalecendo.
  IF coalesce(NEW.price, 0) <> 0 OR NEW.city_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.prosthesis_type_id IS NOT NULL THEN
    SELECT name INTO v_type_name
    FROM public.prosthesis_types
    WHERE id = NEW.prosthesis_type_id;
  END IF;

  IF v_type_name = 'PT - Prótese Total'
     OR v_type_name LIKE 'Contrato — Prótese Total%'
     OR v_service_text = 'PT'
     OR v_service_text LIKE 'PT %'
     OR v_service_text LIKE 'PRÓTESE TOTAL%' THEN
    v_service_code := 'PT';
  ELSIF v_type_name = 'PPR - Prótese Parcial Removível'
     OR v_type_name LIKE 'Contrato — Prótese Parcial%'
     OR v_service_text = 'PPR'
     OR v_service_text LIKE 'PPR %'
     OR v_service_text LIKE 'PRÓTESE PARCIAL REMOVÍVEL%' THEN
    v_service_code := 'PPR';
  ELSE
    RETURN NEW;
  END IF;

  -- Aceita também pequenas variações/typos como "inferios".
  IF v_service_text LIKE '%SUPERIOR%' AND v_service_text LIKE '%INFERI%' THEN
    v_units := 2;
  END IF;

  SELECT unit_price INTO v_price
  FROM public.city_service_prices
  WHERE city_id = NEW.city_id
    AND service_code = v_service_code
    AND active = true
  LIMIT 1;

  IF v_price IS NOT NULL THEN
    NEW.price := v_price * v_units;
  END IF;

  RETURN NEW;
END;
$function$;

-- Correção pontual das OS reais de Tejuçuoca já cadastradas com PT superior+inferior
-- arredondada em R$ 610,00. O valor correto é 2 x R$ 303,00 = R$ 606,00.
UPDATE public.service_orders so
SET price = 606.00, updated_at = now()
FROM public.cities c
WHERE so.city_id = c.id
  AND upper(c.name) = 'TEJUÇUOCA - SECRETARIA DE SAÚDE'
  AND coalesce(so.price, 0) = 610.00
  AND upper(trim(coalesce(so.service_type, ''))) LIKE 'PT %'
  AND upper(coalesce(so.service_type, '')) LIKE '%SUPERIOR%'
  AND upper(coalesce(so.service_type, '')) LIKE '%INFERI%';

-- O resumo passa a contar próteses, não apenas OS/pacientes.
-- Superior+inferior = 2 unidades. Totais consideram somente PT/PPR e excluem canceladas.
CREATE OR REPLACE FUNCTION public.get_city_values_summary()
RETURNS TABLE (
  city_id uuid,
  city_name text,
  pt_unit_price numeric,
  ppr_unit_price numeric,
  pt_count bigint,
  ppr_count bigint,
  total_os_value numeric,
  delivered_value numeric,
  open_value numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
WITH allowed_cities AS (
  SELECT c.id, c.name
  FROM public.cities c
  WHERE lower(trim(c.name)) <> 'uruburetama'
    AND EXISTS (
      SELECT 1
      FROM public.city_service_prices cp
      WHERE cp.city_id = c.id AND cp.active = true
    )
    AND (public.is_admin() OR c.id = public.get_user_city_id())
), prices AS (
  SELECT
    cp.city_id,
    max(cp.unit_price) FILTER (WHERE cp.service_code = 'PT' AND cp.active) AS pt_price,
    max(cp.unit_price) FILTER (WHERE cp.service_code = 'PPR' AND cp.active) AS ppr_price
  FROM public.city_service_prices cp
  GROUP BY cp.city_id
), classed_orders AS (
  SELECT
    so.city_id,
    so.status,
    coalesce(so.price, 0)::numeric AS price,
    CASE
      WHEN pt.name = 'PT - Prótese Total'
        OR pt.name LIKE 'Contrato — Prótese Total%'
        OR upper(trim(coalesce(so.service_type, ''))) = 'PT'
        OR upper(trim(coalesce(so.service_type, ''))) LIKE 'PT %'
        OR upper(trim(coalesce(so.service_type, ''))) LIKE 'PRÓTESE TOTAL%'
        THEN 'PT'
      WHEN pt.name = 'PPR - Prótese Parcial Removível'
        OR pt.name LIKE 'Contrato — Prótese Parcial%'
        OR upper(trim(coalesce(so.service_type, ''))) = 'PPR'
        OR upper(trim(coalesce(so.service_type, ''))) LIKE 'PPR %'
        OR upper(trim(coalesce(so.service_type, ''))) LIKE 'PRÓTESE PARCIAL REMOVÍVEL%'
        THEN 'PPR'
      ELSE NULL
    END AS service_code,
    CASE
      WHEN upper(coalesce(so.service_type, '')) LIKE '%SUPERIOR%'
       AND upper(coalesce(so.service_type, '')) LIKE '%INFERI%'
        THEN 2
      ELSE 1
    END AS unit_count
  FROM public.service_orders so
  JOIN allowed_cities ac ON ac.id = so.city_id
  LEFT JOIN public.prosthesis_types pt ON pt.id = so.prosthesis_type_id
  WHERE so.status <> 'cancelled'
), os_summary AS (
  SELECT
    city_id,
    coalesce(sum(unit_count) FILTER (WHERE service_code = 'PT'), 0)::bigint AS pt_count,
    coalesce(sum(unit_count) FILTER (WHERE service_code = 'PPR'), 0)::bigint AS ppr_count,
    coalesce(sum(price) FILTER (WHERE service_code IN ('PT', 'PPR')), 0) AS total_os_value,
    coalesce(sum(price) FILTER (WHERE service_code IN ('PT', 'PPR') AND status = 'delivered'), 0) AS delivered_value,
    coalesce(sum(price) FILTER (WHERE service_code IN ('PT', 'PPR') AND status IN ('pending', 'in_progress')), 0) AS open_value
  FROM classed_orders
  GROUP BY city_id
)
SELECT
  ac.id AS city_id,
  ac.name AS city_name,
  coalesce(p.pt_price, 0)::numeric AS pt_unit_price,
  coalesce(p.ppr_price, 0)::numeric AS ppr_unit_price,
  coalesce(os.pt_count, 0)::bigint AS pt_count,
  coalesce(os.ppr_count, 0)::bigint AS ppr_count,
  coalesce(os.total_os_value, 0)::numeric AS total_os_value,
  coalesce(os.delivered_value, 0)::numeric AS delivered_value,
  coalesce(os.open_value, 0)::numeric AS open_value
FROM allowed_cities ac
LEFT JOIN prices p ON p.city_id = ac.id
LEFT JOIN os_summary os ON os.city_id = ac.id
ORDER BY ac.name;
$function$;

REVOKE ALL ON FUNCTION public.get_city_values_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_city_values_summary() TO authenticated;

NOTIFY pgrst, 'reload schema';
