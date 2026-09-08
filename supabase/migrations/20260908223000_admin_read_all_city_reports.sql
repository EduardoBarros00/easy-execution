-- Permite que administradores consultem dados de todas as cidades em relatórios,
-- sem ampliar permissões de escrita. Usuários comuns continuam restritos à própria cidade.

DROP POLICY IF EXISTS "admins read all service_orders" ON public.service_orders;
CREATE POLICY "admins read all service_orders"
ON public.service_orders
FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admins read all os_expenses" ON public.os_expenses;
CREATE POLICY "admins read all os_expenses"
ON public.os_expenses
FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admins read all clients" ON public.clients;
CREATE POLICY "admins read all clients"
ON public.clients
FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admins read all technicians" ON public.technicians;
CREATE POLICY "admins read all technicians"
ON public.technicians
FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "admins read all prosthesis_types" ON public.prosthesis_types;
CREATE POLICY "admins read all prosthesis_types"
ON public.prosthesis_types
FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));
