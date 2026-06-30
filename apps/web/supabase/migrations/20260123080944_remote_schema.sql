drop extension if exists "pg_net";

alter table "public"."discounts" drop constraint if exists "discounts_percentage_range";

alter table "public"."discounts" drop constraint if exists "discounts_value_positive";

alter table "public"."cardholder_profiles" add column if not exists "postal_code" character varying(50);

alter table "public"."discounts" drop column if exists "discount_value";

CREATE UNIQUE INDEX IF NOT EXISTS discounts_unique_merchant_id ON public.discounts USING btree (merchant_id);

CREATE INDEX IF NOT EXISTS ix_cardholder_profiles_postal_code ON public.cardholder_profiles USING btree (postal_code) WHERE (postal_code IS NOT NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discounts_unique_merchant_id'
  ) THEN
    ALTER TABLE "public"."discounts" ADD CONSTRAINT "discounts_unique_merchant_id" UNIQUE USING INDEX discounts_unique_merchant_id;
  END IF;
END
$$;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.trigger_log_discount_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_merchant_name text;
BEGIN
  -- Get merchant name
  SELECT a.name INTO v_merchant_name
  FROM public.accounts a
  WHERE a.id = new.merchant_id;

  -- Discount created
  IF tg_op = 'INSERT' THEN
    PERFORM public.log_activity(
      'discount_created'::public.activity_type,
      'Discount campaign created: "' || new.title || '" - ' || v_merchant_name,
      NULL,
      new.merchant_id,
      'discount',
      new.id,
      jsonb_build_object('title', new.title)
    );
  END IF;

  -- Discount updated
  IF tg_op = 'UPDATE' THEN
    PERFORM public.log_activity(
      'discount_updated'::public.activity_type,
      'Discount campaign updated: "' || new.title || '" - ' || v_merchant_name,
      NULL,
      new.merchant_id,
      'discount',
      new.id,
      jsonb_build_object('title', new.title)
    );
  END IF;

  RETURN new;
END;
$function$
;


