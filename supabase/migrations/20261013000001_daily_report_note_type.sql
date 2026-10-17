-- ==============================================================================
-- DAVEJOE MANAGEMENT TOOL — PHASE 9.1A MIGRATION PROPOSAL (FOR REVIEW)
-- ==============================================================================
-- Purpose: Adds 'daily_report' to the PostgreSQL enum `project_note_type` to allow
-- native enum tagging of digital site reports in public.project_notes.
--
-- Safety: Non-destructive, append-only enum alteration.
-- ==============================================================================

ALTER TYPE public.project_note_type ADD VALUE IF NOT EXISTS 'daily_report';
