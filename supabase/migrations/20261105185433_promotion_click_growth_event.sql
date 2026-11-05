DO $$
DECLARE current_definition text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO current_definition FROM pg_constraint WHERE conrelid='public.growth_events'::regclass AND conname='growth_events_event_type_allowed';
  IF current_definition IS NULL THEN RAISE EXCEPTION 'Expected growth event constraint missing'; END IF;
  IF position('promotion_clicked' in current_definition)=0 THEN
    ALTER TABLE public.growth_events DROP CONSTRAINT growth_events_event_type_allowed;
    EXECUTE 'ALTER TABLE public.growth_events ADD CONSTRAINT growth_events_event_type_allowed CHECK ((event_type = ''promotion_clicked'') OR (' || substring(current_definition from 8 for char_length(current_definition)-8) || '))';
  END IF;
END $$;
