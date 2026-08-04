
-- Allow anonymous users to list cities on the login screen
CREATE POLICY "public read cities" ON public.cities FOR SELECT TO anon USING (true);
GRANT SELECT ON public.cities TO anon;

-- Add city to profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city_id uuid;

-- Seed Itaitinga for the existing owner if not present
INSERT INTO public.cities (owner_id, name, uf)
SELECT '10bda9b5-ac65-4a90-b01c-5dec7d8d56a2'::uuid, 'Itaitinga', 'CE'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cities WHERE name='Itaitinga' AND owner_id='10bda9b5-ac65-4a90-b01c-5dec7d8d56a2'::uuid
);
