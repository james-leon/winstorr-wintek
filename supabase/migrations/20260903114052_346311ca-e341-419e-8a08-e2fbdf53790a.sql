CREATE TABLE public.payment_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'campay',
  reference text,
  external_reference text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'XAF',
  operator text,
  phone text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payment_transactions_provider_reference_key
  ON public.payment_transactions(provider, reference) WHERE reference IS NOT NULL;
CREATE INDEX payment_transactions_order_id_idx ON public.payment_transactions(order_id);
CREATE INDEX payment_transactions_external_reference_idx ON public.payment_transactions(external_reference);

GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view payment transactions"
  ON public.payment_transactions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER payment_transactions_set_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (key, value)
VALUES ('payment_methods', '{"campay": true, "cinetpay": false, "cash_on_pickup": true}'::jsonb)
ON CONFLICT (key) DO UPDATE
  SET value = public.app_settings.value || '{"campay": true}'::jsonb,
      updated_at = now();