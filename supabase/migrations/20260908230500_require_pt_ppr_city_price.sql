-- Defense in depth: a PT/PPR OS with automatic pricing must never be saved at R$ 0
-- just because the city has no configured contract price. Manual non-zero prices remain allowed.
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
  -- A non-zero value is considered an intentional/manual snapshot and is preserved.
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

  IF v_service_text LIKE '%SUPERIOR%' AND v_service_text LIKE '%INFERI%' THEN
    v_units := 2;
  END IF;

  SELECT unit_price INTO v_price
  FROM public.city_service_prices
  WHERE city_id = NEW.city_id
    AND service_code = v_service_code
    AND active = true
  LIMIT 1;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Preço de % não configurado para esta cidade. Cadastre em Valores por Cidade ou informe um valor manual.', v_service_code;
  END IF;

  NEW.price := v_price * v_units;
  RETURN NEW;
END;
$function$;
