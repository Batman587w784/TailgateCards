-- Function to get distributor total revenue (for admin view)
-- Returns sum of all card prices for cards assigned to a distributor
CREATE OR REPLACE FUNCTION public.get_distributor_total_revenue(distributor_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(price_cents), 0)::bigint
  FROM public.cards
  WHERE distributor_id = distributor_account_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_total_revenue(uuid) TO authenticated, service_role;
