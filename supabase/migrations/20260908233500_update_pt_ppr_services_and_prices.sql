-- Ajusta preços PT/PPR conforme documento validado e reforça a regra de arcadas.

-- Valores unitários por cidade. Não renomeamos municípios existentes.
WITH price_updates(city_name, service_code, unit_price) AS (
  VALUES
    ('TEJUÇUOCA - SECRETARIA DE SAÚDE', 'PT', 305.00::numeric),
    ('TEJUÇUOCA - SECRETARIA DE SAÚDE', 'PPR', 405.00::numeric),
    ('BARREIRA - SECRETARIA DE SAÚDE', 'PT', 454.23::numeric),
    ('BARREIRA - SECRETARIA DE SAÚDE', 'PPR', 368.06::numeric),
    ('REDENÇÃO - SECRETARIA DE SAÚDE', 'PT', 479.33::numeric),
    ('REDENÇÃO - SECRETARIA DE SAÚDE', 'PPR', 489.67::numeric),
    ('GUAIÚBA - SECRETARIA DE SAÚDE', 'PT', 642.46::numeric),
    ('GUAIÚBA - SECRETARIA DE SAÚDE', 'PPR', 554.16::numeric),
    ('LIMOEIRO - SECRETARIA DE SAÚDE', 'PT', 526.59::numeric),
    ('LIMOEIRO - SECRETARIA DE SAÚDE', 'PPR', 499.22::numeric),
    ('GENERAL SAMPAIO - SECRETARIA DE SAÚDE', 'PT', 370.00::numeric),
    ('GENERAL SAMPAIO - SECRETARIA DE SAÚDE', 'PPR', 469.96::numeric)
)
UPDATE public.city_service_prices cp
SET unit_price = u.unit_price,
    updated_at = now()
FROM price_updates u
JOIN public.cities c ON c.name = u.city_name
WHERE cp.city_id = c.id
  AND cp.service_code = u.service_code;

-- Canoniza descrições legadas sem alterar a modalidade ou quantidade real.
UPDATE public.service_orders
SET service_type = 'PPR superior e inferior'
WHERE upper(trim(coalesce(service_type,''))) LIKE 'PPR%'
  AND upper(coalesce(service_type,'')) LIKE '%SUPERIOR%'
  AND upper(coalesce(service_type,'')) LIKE '%INFERI%';

-- PT superior+inferior passa a ser exibida como PT total, conforme regra operacional confirmada.
UPDATE public.service_orders
SET service_type = 'PT total (superior e inferior)'
WHERE upper(trim(coalesce(service_type,''))) LIKE 'PT%'
  AND upper(coalesce(service_type,'')) LIKE '%SUPERIOR%'
  AND upper(coalesce(service_type,'')) LIKE '%INFERI%';

-- Corrige apenas snapshots que correspondem exatamente ao antigo preço automático de Tejuçuoca.
UPDATE public.service_orders so
SET price = 610.00
FROM public.cities c
WHERE so.city_id = c.id
  AND c.name = 'TEJUÇUOCA - SECRETARIA DE SAÚDE'
  AND so.price = 606.00
  AND upper(trim(coalesce(so.service_type,''))) LIKE 'PT%'
  AND (
    upper(coalesce(so.service_type,'')) LIKE 'PT TOTAL%'
    OR (
      upper(coalesce(so.service_type,'')) LIKE '%SUPERIOR%'
      AND upper(coalesce(so.service_type,'')) LIKE '%INFERI%'
    )
  );

CREATE OR REPLACE FUNCTION public.tg_apply_city_service_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_type_name text;
  v_service_code text;
  v_price numeric(12,2);
  v_units integer := 1;
  v_service_text text := upper(trim(coalesce(NEW.service_type, '')));
BEGIN
  -- Valor manual diferente de zero sempre prevalece.
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

  -- 1 unidade para superior OU inferior. 2 unidades para ambas.
  IF (v_service_text LIKE '%SUPERIOR%' AND v_service_text LIKE '%INFERI%')
     OR (v_service_code = 'PT' AND (v_service_text = 'PT TOTAL' OR v_service_text LIKE 'PT TOTAL %')) THEN
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

CREATE OR REPLACE FUNCTION public.get_city_values_summary()
RETURNS TABLE(
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
SET search_path TO 'public'
AS $function$
WITH allowed_cities AS (
  SELECT c.id, c.name
  FROM public.cities c
  WHERE lower(trim(c.name)) <> 'uruburetama'
    AND EXISTS (
      SELECT 1 FROM public.city_service_prices cp
      WHERE cp.city_id = c.id AND cp.active = true
    )
    AND (public.is_admin() OR c.id = public.get_user_city_id())
), prices AS (
  SELECT cp.city_id,
    max(cp.unit_price) FILTER (WHERE cp.service_code = 'PT' AND cp.active) AS pt_price,
    max(cp.unit_price) FILTER (WHERE cp.service_code = 'PPR' AND cp.active) AS ppr_price
  FROM public.city_service_prices cp
  GROUP BY cp.city_id
), classed_orders AS (
  SELECT so.city_id,
    so.status,
    coalesce(so.price,0)::numeric AS price,
    CASE
      WHEN pt.name = 'PT - Prótese Total'
        OR pt.name LIKE 'Contrato — Prótese Total%'
        OR upper(trim(coalesce(so.service_type,''))) = 'PT'
        OR upper(trim(coalesce(so.service_type,''))) LIKE 'PT %'
        OR upper(trim(coalesce(so.service_type,''))) LIKE 'PRÓTESE TOTAL%' THEN 'PT'
      WHEN pt.name = 'PPR - Prótese Parcial Removível'
        OR pt.name LIKE 'Contrato — Prótese Parcial%'
        OR upper(trim(coalesce(so.service_type,''))) = 'PPR'
        OR upper(trim(coalesce(so.service_type,''))) LIKE 'PPR %'
        OR upper(trim(coalesce(so.service_type,''))) LIKE 'PRÓTESE PARCIAL REMOVÍVEL%' THEN 'PPR'
      ELSE NULL
    END AS service_code,
    CASE
      WHEN (
        upper(coalesce(so.service_type,'')) LIKE '%SUPERIOR%'
        AND upper(coalesce(so.service_type,'')) LIKE '%INFERI%'
      )
      OR upper(trim(coalesce(so.service_type,''))) = 'PT TOTAL'
      OR upper(trim(coalesce(so.service_type,''))) LIKE 'PT TOTAL %'
      THEN 2
      ELSE 1
    END AS unit_count
  FROM public.service_orders so
  JOIN allowed_cities ac ON ac.id = so.city_id
  LEFT JOIN public.prosthesis_types pt ON pt.id = so.prosthesis_type_id
  WHERE so.status <> 'cancelled'
), os_summary AS (
  SELECT city_id,
    coalesce(sum(unit_count) FILTER (WHERE service_code='PT'),0)::bigint AS pt_count,
    coalesce(sum(unit_count) FILTER (WHERE service_code='PPR'),0)::bigint AS ppr_count,
    coalesce(sum(price) FILTER (WHERE service_code IN ('PT','PPR')),0) AS total_os_value,
    coalesce(sum(price) FILTER (WHERE service_code IN ('PT','PPR') AND status='delivered'),0) AS delivered_value,
    coalesce(sum(price) FILTER (WHERE service_code IN ('PT','PPR') AND status IN ('pending','in_progress')),0) AS open_value
  FROM classed_orders
  GROUP BY city_id
)
SELECT ac.id,
  ac.name,
  coalesce(p.pt_price,0)::numeric,
  coalesce(p.ppr_price,0)::numeric,
  coalesce(os.pt_count,0)::bigint,
  coalesce(os.ppr_count,0)::bigint,
  coalesce(os.total_os_value,0)::numeric,
  coalesce(os.delivered_value,0)::numeric,
  coalesce(os.open_value,0)::numeric
FROM allowed_cities ac
LEFT JOIN prices p ON p.city_id = ac.id
LEFT JOIN os_summary os ON os.city_id = ac.id
ORDER BY ac.name;
$function$;
