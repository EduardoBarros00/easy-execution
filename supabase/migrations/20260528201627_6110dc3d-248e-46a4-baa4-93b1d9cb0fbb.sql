
CREATE OR REPLACE FUNCTION public.tg_os_sync_finance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status fin_status;
  v_paid_at date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.finance_entries WHERE os_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.status = 'delivered' THEN
    v_status := 'paid';
    v_paid_at := COALESCE(NEW.delivered_at, CURRENT_DATE);
  ELSE
    v_status := 'pending';
    v_paid_at := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.price, 0) > 0 THEN
      INSERT INTO public.finance_entries (owner_id, os_id, client_id, kind, status, amount, description, due_date, paid_at)
      VALUES (NEW.owner_id, NEW.id, NEW.client_id, 'income', v_status, NEW.price,
              'OS ' || NEW.code || COALESCE(' - ' || NEW.patient_name, ''),
              NEW.expected_at, v_paid_at);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF EXISTS (SELECT 1 FROM public.finance_entries WHERE os_id = NEW.id) THEN
    IF COALESCE(NEW.price, 0) > 0 THEN
      UPDATE public.finance_entries
      SET amount = NEW.price,
          status = v_status,
          paid_at = v_paid_at,
          due_date = NEW.expected_at,
          client_id = NEW.client_id,
          description = 'OS ' || NEW.code || COALESCE(' - ' || NEW.patient_name, ''),
          updated_at = now()
      WHERE os_id = NEW.id;
    ELSE
      DELETE FROM public.finance_entries WHERE os_id = NEW.id;
    END IF;
  ELSIF COALESCE(NEW.price, 0) > 0 THEN
    INSERT INTO public.finance_entries (owner_id, os_id, client_id, kind, status, amount, description, due_date, paid_at)
    VALUES (NEW.owner_id, NEW.id, NEW.client_id, 'income', v_status, NEW.price,
            'OS ' || NEW.code || COALESCE(' - ' || NEW.patient_name, ''),
            NEW.expected_at, v_paid_at);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_orders_sync_finance ON public.service_orders;
CREATE TRIGGER service_orders_sync_finance
AFTER INSERT OR UPDATE OR DELETE ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION public.tg_os_sync_finance();

-- Backfill existing service orders that don't yet have a finance entry
INSERT INTO public.finance_entries (owner_id, os_id, client_id, kind, status, amount, description, due_date, paid_at)
SELECT so.owner_id, so.id, so.client_id, 'income',
       CASE WHEN so.status = 'delivered' THEN 'paid'::fin_status ELSE 'pending'::fin_status END,
       so.price,
       'OS ' || so.code || COALESCE(' - ' || so.patient_name, ''),
       so.expected_at,
       CASE WHEN so.status = 'delivered' THEN COALESCE(so.delivered_at, CURRENT_DATE) END
FROM public.service_orders so
WHERE COALESCE(so.price, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.finance_entries fe WHERE fe.os_id = so.id);
