-- ═══════════════════════════════════════════════════
-- 🔧 Setup: execute_safe_migration RPC function
-- ═══════════════════════════════════════════════════
-- 
-- הרץ את ה-SQL הזה פעם אחת דרך Supabase Dashboard:
-- https://supabase.com/dashboard/project/suyrxqgiszktpziizklu/sql
--
-- הפונקציה מאפשרת להריץ SQL מרחוק דרך RPC
-- ═══════════════════════════════════════════════════

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

-- Only admins can see migration logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    EXECUTE 'CREATE POLICY "Admins can view migrations" ON public.migration_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''))';
  ELSE
    EXECUTE 'CREATE POLICY "Admins can view migrations" ON public.migration_logs FOR ALL TO authenticated USING (true)';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- policy already exists
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
  -- Log the migration start
  INSERT INTO migration_logs (name, sql_content, status)
  VALUES (p_migration_name, p_migration_sql, 'running');
  
  BEGIN
    -- Execute the SQL
    EXECUTE p_migration_sql;
    
    -- Update log as success
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
    
    -- Update log as failed
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

-- Grant execute to authenticated users (RPC needs this)
GRANT EXECUTE ON FUNCTION public.execute_safe_migration(TEXT, TEXT) TO authenticated;
