ALTER TABLE public.service_orders
ADD COLUMN IF NOT EXISTS contractor_name text,
ADD COLUMN IF NOT EXISTS dentist_name text;

UPDATE public.service_orders so
SET
  contractor_name = COALESCE(so.contractor_name, c.contractor_name, c.dentist_name),
  dentist_name = COALESCE(so.dentist_name, c.dentist_name)
FROM public.clients c
WHERE so.client_id = c.id
  AND so.owner_id = c.owner_id
  AND (so.contractor_name IS NULL OR so.dentist_name IS NULL);