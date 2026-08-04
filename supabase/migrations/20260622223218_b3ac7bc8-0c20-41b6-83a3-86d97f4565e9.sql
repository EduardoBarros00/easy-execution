
-- Seed default expense categories for existing owners (idempotent by name+kind)
INSERT INTO public.finance_categories (owner_id, name, kind, city_id)
SELECT p.id, c.name, 'expense'::public.fin_kind, p.city_id
FROM public.profiles p
CROSS JOIN (VALUES
  ('Protético'),
  ('Dentista'),
  ('Gasolina'),
  ('Alimentação'),
  ('Material'),
  ('Manutenção'),
  ('Aluguel'),
  ('Impostos'),
  ('Outras Despesas')
) AS c(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.finance_categories fc
  WHERE fc.owner_id = p.id AND fc.name = c.name AND fc.kind = 'expense'
);

-- Update new-user handler to seed the expanded category set
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  INSERT INTO public.prosthesis_types (owner_id, name, default_price, default_cost, default_commission_pct, avg_days) VALUES
    (NEW.id, 'PPR - Prótese Parcial Removível', 0, 0, 0, 10),
    (NEW.id, 'PT - Prótese Total', 0, 0, 0, 10),
    (NEW.id, 'Prótese Fixa', 0, 0, 0, 7),
    (NEW.id, 'Coroa', 0, 0, 0, 5),
    (NEW.id, 'Implante', 0, 0, 0, 14),
    (NEW.id, 'Ortodontia', 0, 0, 0, 7),
    (NEW.id, 'Outros', 0, 0, 0, 5);

  INSERT INTO public.finance_categories (owner_id, name, kind) VALUES
    (NEW.id, 'Serviços de Prótese', 'income'),
    (NEW.id, 'Outras Receitas', 'income'),
    (NEW.id, 'Protético', 'expense'),
    (NEW.id, 'Dentista', 'expense'),
    (NEW.id, 'Gasolina', 'expense'),
    (NEW.id, 'Alimentação', 'expense'),
    (NEW.id, 'Material', 'expense'),
    (NEW.id, 'Manutenção', 'expense'),
    (NEW.id, 'Aluguel', 'expense'),
    (NEW.id, 'Impostos', 'expense'),
    (NEW.id, 'Outras Despesas', 'expense');

  RETURN NEW;
END $function$;
