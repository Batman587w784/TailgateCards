-- Rename all "Legacy Cards" batches to "-"
UPDATE public.batches
SET name = '-'
WHERE name = 'Legacy Cards';
