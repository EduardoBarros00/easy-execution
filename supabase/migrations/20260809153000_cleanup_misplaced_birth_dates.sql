-- Corrige registros importados em que a data de nascimento foi gravada por engano no campo documento.
UPDATE public.patients
SET document = NULL
WHERE document IS NOT NULL
  AND birth_date IS NOT NULL
  AND document = birth_date::text;
