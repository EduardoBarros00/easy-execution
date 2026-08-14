-- Permite que todos os usuarios autenticados consultem os contratantes.
-- Criacao, alteracao e exclusao continuam limitadas a cidade do usuario.

DROP POLICY IF EXISTS "city scoped clients" ON public.clients;
DROP POLICY IF EXISTS "own clients" ON public.clients;
DROP POLICY IF EXISTS "authenticated read all clients" ON public.clients;
DROP POLICY IF EXISTS "city insert clients" ON public.clients;
DROP POLICY IF EXISTS "city update clients" ON public.clients;
DROP POLICY IF EXISTS "city delete clients" ON public.clients;

CREATE POLICY "authenticated read all clients"
ON public.clients
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "city insert clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_city(city_id));

CREATE POLICY "city update clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (public.can_access_city(city_id))
WITH CHECK (public.can_access_city(city_id));

CREATE POLICY "city delete clients"
ON public.clients
FOR DELETE
TO authenticated
USING (public.can_access_city(city_id));
