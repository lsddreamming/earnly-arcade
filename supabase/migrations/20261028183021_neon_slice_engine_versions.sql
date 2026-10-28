-- Keep old clients and outstanding rounds on the exact original replay rules.
ALTER TABLE public.neon_slice_rounds ADD COLUMN engine_version smallint NOT NULL DEFAULT 1 CHECK (engine_version IN (1,2));
-- Only the trusted edge handler can open a v2 ticket; clients cannot change it.
GRANT UPDATE (engine_version) ON public.neon_slice_rounds TO service_role;
CREATE FUNCTION public.neon_slice_start_v2(p_user_id uuid,p_seed bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 result := public.neon_slice_start(p_user_id,p_seed);
 IF result ? 'id' THEN
  UPDATE public.neon_slice_rounds SET engine_version=2 WHERE id=(result->>'id')::uuid AND user_id=p_user_id;
 END IF;
 RETURN result || jsonb_build_object('engineVersion',2);
END $$;
REVOKE ALL ON FUNCTION public.neon_slice_start_v2(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.neon_slice_start_v2(uuid,bigint) TO service_role;
