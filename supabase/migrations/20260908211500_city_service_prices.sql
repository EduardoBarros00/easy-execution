-- Tabela de preços específica por cidade/contratante.
-- Mudança aditiva: não altera prosthesis_types nem valores históricos das OS.
CREATE TABLE IF NOT EXISTS public.city_service_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  service_code text NOT NULL CHECK (service_code IN ('PT', 'PPR')),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, service_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.city_service_prices TO authenticated;
GRANT ALL ON public.city_service_prices TO service_role;
ALTER TABLE public.city_service_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "city prices read" ON public.city_service_prices;
CREATE POLICY "city prices read"
ON public.city_service_prices
FOR SELECT TO authenticated
USING (public.is_admin() OR public.can_access_city(city_id));

DROP POLICY IF EXISTS "admins manage city prices" ON public.city_service_prices;
CREATE POLICY "admins manage city prices"
ON public.city_service_prices
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS city_service_prices_updated_at ON public.city_service_prices;
CREATE TRIGGER city_service_prices_updated_at
BEFORE UPDATE ON public.city_service_prices
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Valores informados para os contratos reais. Uruburetama é apenas teste e não entra aqui.
WITH seed(city_name, service_code, unit_price) AS (
  VALUES
    ('TEJUÇUOCA - SECRETARIA DE SAÚDE', 'PT', 303.00::numeric),
    ('TEJUÇUOCA - SECRETARIA DE SAÚDE', 'PPR', 405.00::numeric),
    ('BARREIRA - SECRETARIA DE SAÚDE', 'PT', 454.23::numeric),
    ('BARREIRA - SECRETARIA DE SAÚDE', 'PPR', 358.06::numeric),
    ('REDENÇÃO - SECRETARIA DE SAÚDE', 'PT', 479.33::numeric),
    ('REDENÇÃO - SECRETARIA DE SAÚDE', 'PPR', 484.67::numeric),
    ('GUAIÚBA - SECRETARIA DE SAÚDE', 'PT', 642.46::numeric),
    ('GUAIÚBA - SECRETARIA DE SAÚDE', 'PPR', 554.16::numeric),
    ('LIMOEIRO - SECRETARIA DE SAÚDE', 'PT', 526.59::numeric),
    ('LIMOEIRO - SECRETARIA DE SAÚDE', 'PPR', 499.22::numeric),
    ('GENERAL SAMPAIO - SECRETARIA DE SAÚDE', 'PT', 370.00::numeric),
    ('GENERAL SAMPAIO - SECRETARIA DE SAÚDE', 'PPR', 469.96::numeric)
)
INSERT INTO public.city_service_prices (city_id, service_code, unit_price)
SELECT c.id, s.service_code, s.unit_price
FROM seed s
JOIN public.cities c ON upper(c.name) = upper(s.city_name)
ON CONFLICT (city_id, service_code)
DO UPDATE SET unit_price = EXCLUDED.unit_price, active = true, updated_at = now();

-- Preço automático na OS: só aplica quando o valor informado está vazio/zero.
-- Assim, preços manuais e OS antigas continuam preservados.
CREATE OR REPLACE FUNCTION public.tg_apply_city_service_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $function$
DECLARE
  v_type_name text;
  v_service_code text;
  v_price numeric(12,2);
  v_service_text text := upper(trim(coalesce(NEW.service_type, '')));
BEGIN
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

  SELECT unit_price INTO v_price
  FROM public.city_service_prices
  WHERE city_id = NEW.city_id
    AND service_code = v_service_code
    AND active = true
  LIMIT 1;

  IF v_price IS NOT NULL THEN
    NEW.price := v_price;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS zz_apply_city_service_price ON public.service_orders;
CREATE TRIGGER zz_apply_city_service_price
BEFORE INSERT OR UPDATE ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_city_service_price();

REVOKE ALL ON FUNCTION public.tg_apply_city_service_price() FROM PUBLIC, anon, authenticated;

-- Resumo seguro: admin vê todas as cidades precificadas; usuário comum vê apenas a própria cidade.
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
      SELECT 1 FROM public.city_service_prices cp
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
    END AS service_code
  FROM public.service_orders so
  JOIN allowed_cities ac ON ac.id = so.city_id
  LEFT JOIN public.prosthesis_types pt ON pt.id = so.prosthesis_type_id
  WHERE so.status <> 'cancelled'
), os_summary AS (
  SELECT
    city_id,
    count(*) FILTER (WHERE service_code = 'PT') AS pt_count,
    count(*) FILTER (WHERE service_code = 'PPR') AS ppr_count,
    coalesce(sum(price), 0) AS total_os_value,
    coalesce(sum(price) FILTER (WHERE status = 'delivered'), 0) AS delivered_value,
    coalesce(sum(price) FILTER (WHERE status IN ('pending', 'in_progress')), 0) AS open_value
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
