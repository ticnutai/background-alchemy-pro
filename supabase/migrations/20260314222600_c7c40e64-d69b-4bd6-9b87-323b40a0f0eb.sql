
-- Migration log table
CREATE TABLE IF NOT EXISTS public.migration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sql_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.migration_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'migration_logs' AND policyname = 'Admins can manage migrations') THEN
    EXECUTE 'CREATE POLICY "Admins can manage migrations" ON public.migration_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END;
$$;

-- The main function: executes SQL and logs results
CREATE OR REPLACE FUNCTION public.execute_safe_migration(
  p_migration_name TEXT,
  p_migration_sql TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_error TEXT;
BEGIN
  INSERT INTO migration_logs (name, sql_content, status)
  VALUES (p_migration_name, p_migration_sql, 'running');

  BEGIN
    EXECUTE p_migration_sql;

    UPDATE migration_logs
    SET status = 'completed', executed_at = now()
    WHERE name = p_migration_name AND status = 'running';

    v_result := json_build_object(
      'success', true,
      'message', 'Migration completed successfully',
      'name', p_migration_name
    );

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;

    UPDATE migration_logs
    SET status = 'failed', error_message = v_error, executed_at = now()
    WHERE name = p_migration_name AND status = 'running';

    v_result := json_build_object(
      'success', false,
      'error', v_error,
      'name', p_migration_name
    );
  END;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_safe_migration(TEXT, TEXT) TO authenticated;
