-- Add v3 without changing existing or outstanding v1/v2 rounds.
ALTER TABLE public.neon_slice_rounds DROP CONSTRAINT neon_slice_rounds_engine_version_check;
ALTER TABLE public.neon_slice_rounds ADD CONSTRAINT neon_slice_rounds_engine_version_check CHECK(engine_version IN (1,2,3));
CREATE FUNCTION public.neon_slice_start_v3(p_user_id uuid,p_seed bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 result := public.neon_slice_start(p_user_id,p_seed);
 IF result ? 'id' THEN
  UPDATE public.neon_slice_rounds SET engine_version=3 WHERE id=(result->>'id')::uuid AND user_id=p_user_id;
 END IF;
 RETURN result || jsonb_build_object('engineVersion',3);
END $$;
REVOKE ALL ON FUNCTION public.neon_slice_start_v3(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.neon_slice_start_v3(uuid,bigint) TO service_role;
