
-- Create storage bucket for processed images
INSERT INTO storage.buckets (id, name, public) VALUES ('processed-images', 'processed-images', true);

-- Create processing history table
CREATE TABLE public.processing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  original_image_url TEXT NOT NULL,
  result_image_url TEXT NOT NULL,
  background_prompt TEXT NOT NULL,
  background_name TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history" ON public.processing_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON public.processing_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own history" ON public.processing_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON public.processing_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Favorite backgrounds table
CREATE TABLE public.favorite_backgrounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  preset_id TEXT,
  custom_prompt TEXT,
  background_name TEXT NOT NULL,
  preview_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, preset_id),
  UNIQUE(user_id, custom_prompt)
);

ALTER TABLE public.favorite_backgrounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites" ON public.favorite_backgrounds
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites" ON public.favorite_backgrounds
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON public.favorite_backgrounds
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage policies for processed-images bucket
CREATE POLICY "Users can upload own images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'processed-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'processed-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view processed images" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'processed-images');
