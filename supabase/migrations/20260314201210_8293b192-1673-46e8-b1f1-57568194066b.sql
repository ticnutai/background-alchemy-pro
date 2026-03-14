
-- Create image_folders table
CREATE TABLE public.image_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#D4A853',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.image_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders" ON public.image_folders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own folders" ON public.image_folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own folders" ON public.image_folders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own folders" ON public.image_folders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add folder_id to processing_history
ALTER TABLE public.processing_history ADD COLUMN folder_id uuid REFERENCES public.image_folders(id) ON DELETE SET NULL;
