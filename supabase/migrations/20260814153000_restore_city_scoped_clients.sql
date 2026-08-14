-- Restaura o isolamento dos contratantes por cidade.
-- Cada usuario autenticado volta a consultar e alterar somente os registros
-- permitidos pela funcao can_access_city.

DROP POLICY IF EXISTS "authenticated read all clients" ON public.clients;
DROP POLICY IF EXISTS "city insert clients" ON public.clients;
DROP POLICY IF EXISTS "city update clients" ON public.clients;
DROP POLICY IF EXISTS "city delete clients" ON public.clients;
DROP POLICY IF EXISTS "city scoped clients" ON public.clients;

CREATE POLICY "city scoped clients"
ON public.clients
FOR ALL
TO authenticated
USING (public.can_access_city(city_id))
WITH CHECK (public.can_access_city(city_id));
