ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS molding_date date,
  ADD COLUMN IF NOT EXISTS wax_plan_date date,
  ADD COLUMN IF NOT EXISTS teeth_setup_date date,
  ADD COLUMN IF NOT EXISTS acrylization_date date;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS products text;