-- The OS form intentionally falls back to catalog rows with city_id IS NULL
-- when a city has no custom catalog. Allow authenticated users to read only
-- those global rows, while city-specific rows remain protected by existing RLS.
DROP POLICY IF EXISTS "authenticated read global prosthesis types" ON public.prosthesis_types;
CREATE POLICY "authenticated read global prosthesis types"
ON public.prosthesis_types
FOR SELECT
TO authenticated
USING (city_id IS NULL);
