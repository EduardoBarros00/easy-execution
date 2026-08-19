-- Registra a relacao usada pelo PostgREST entre profiles e cities.
-- A coluna ja existe; esta migracao apenas adiciona a chave estrangeira.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_city_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_city_id_fkey
      FOREIGN KEY (city_id)
      REFERENCES public.cities(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS profiles_city_id_idx
  ON public.profiles(city_id);

NOTIFY pgrst, 'reload schema';
