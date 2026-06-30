/*
 * Migration: Fix card activity trigger to use card_number instead of card_code
 *
 * The original trigger function references `new.card_code` which doesn't exist.
 * The cards table uses `card_number` and the display code is constructed from
 * organization.card_prefix + '-' + card_number.
 */

-- Replace the trigger function with corrected version
CREATE OR REPLACE FUNCTION public.trigger_log_card_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_name text;
  v_org_prefix text;
  v_actor_name text;
  v_display_code text;
BEGIN
  -- Get organization name and card_prefix
  SELECT name, card_prefix INTO v_org_name, v_org_prefix
  FROM public.accounts
  WHERE id = new.organization_id;

  -- Construct display code (e.g., "TIGER-1")
  v_display_code := coalesce(v_org_prefix, 'CARD') || '-' || new.card_number::text;

  -- Get actor name (distributor or org)
  IF new.distributor_id IS NOT NULL THEN
    SELECT name INTO v_actor_name
    FROM public.accounts
    WHERE id = new.distributor_id;
  END IF;

  -- Card sold (status changed to paid)
  IF tg_op = 'UPDATE' AND old.status = 'pending' AND new.status = 'paid' THEN
    PERFORM public.log_activity(
      'card_sold'::public.activity_type,
      coalesce(v_actor_name, v_org_name) || ' sold card ' || v_display_code || ' - ' || new.payment_type,
      new.distributor_id,
      new.organization_id,
      'card',
      new.id,
      jsonb_build_object('card_code', v_display_code, 'payment_type', new.payment_type, 'price_cents', new.price_cents)
    );
  END IF;

  -- Card activated
  IF tg_op = 'UPDATE' AND old.status != 'activated' AND new.status = 'activated' THEN
    PERFORM public.log_activity(
      'card_activated'::public.activity_type,
      'Card ' || v_display_code || ' activated successfully',
      new.cardholder_id,
      new.organization_id,
      'card',
      new.id,
      jsonb_build_object('card_code', v_display_code, 'cardholder_id', new.cardholder_id)
    );
  END IF;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.trigger_log_card_activity IS 'Logs card status changes (sold, activated) to the activities table';
