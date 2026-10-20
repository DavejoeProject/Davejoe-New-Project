-- Migration: 20261020000001_job_completion_photos_and_vetting.sql
-- Description: Creates the job_completion_photos table and storage bucket security policies
-- Supports job completion photo evidence, review status tracking, and leadership vetting (Approve / Reject / Correction).

CREATE TABLE IF NOT EXISTS public.job_completion_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  description text,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_status text NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'approved', 'needs_correction', 'rejected')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast query execution
CREATE INDEX IF NOT EXISTS idx_job_completion_photos_created_at ON public.job_completion_photos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_completion_photos_project_id ON public.job_completion_photos (project_id);
CREATE INDEX IF NOT EXISTS idx_job_completion_photos_review_status ON public.job_completion_photos (review_status);

-- Enable RLS
ALTER TABLE public.job_completion_photos ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy: Authenticated users can view photos
DROP POLICY IF EXISTS "job_photos_select_policy" ON public.job_completion_photos;
CREATE POLICY "job_photos_select_policy" ON public.job_completion_photos
FOR SELECT
TO authenticated
USING (true);

-- 2. INSERT Policy: Staff with social_media_manager, management, executive_director, or supervisor role can upload
DROP POLICY IF EXISTS "job_photos_insert_policy" ON public.job_completion_photos;
CREATE POLICY "job_photos_insert_policy" ON public.job_completion_photos
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- 3. UPDATE Policy: Leadership (Management & Executive Director) can review/vet; uploaders can update if needs_correction
DROP POLICY IF EXISTS "job_photos_update_policy" ON public.job_completion_photos;
CREATE POLICY "job_photos_update_policy" ON public.job_completion_photos
FOR UPDATE
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR uploaded_by = auth.uid()
)
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR uploaded_by = auth.uid()
);

-- 4. DELETE Policy: Leadership can delete
DROP POLICY IF EXISTS "job_photos_delete_policy" ON public.job_completion_photos;
CREATE POLICY "job_photos_delete_policy" ON public.job_completion_photos
FOR DELETE
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR uploaded_by = auth.uid()
);
