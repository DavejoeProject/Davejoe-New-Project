-- ==============================================================================
-- DAVEJOE INTERIORS DIGITAL OPERATING SYSTEM
-- MIGRATION: 20261125000004_centralized_realtime_notifications.sql
--
-- Purpose:
--   1. Create centralized, tenant- and role-isolated `public.notifications`
--      backing real-time header bells AND sidebar/menu alert indicators across
--      all 9 staff roles and the Client Experience & Project Partner Portal.
--   2. Enforce strict Row-Level Security (users may ONLY read their own
--      notifications and update ONLY `is_read` / `read_at`; NO direct client
--      INSERT or DELETE policies so notifications cannot be forged).
--   3. Provide hardened SECURITY DEFINER notification emitters & RPCs with
--      idempotency (`UNIQUE (recipient_user_id, event_key)`).
--   4. Install real database triggers across 21 operational tables covering
--      assignments, approvals, project communications, blockers/delays,
--      post-completion damage incidents, service requests, delegations, and
--      confidential management escalations (strictly isolating confidential
--      complaints to Management & Executive Director, excluding subject_user_id,
--      and redacting preview text).
--   5. Enable Supabase Realtime publication for `public.notifications`.
--
-- Safety:
--   - 100% additive & idempotent (safe to re-run).
--   - No destructive DROP TABLE statements.
--   - Every column referenced in triggers is verified against actual migrations.
--   - Pre-existing legacy tables guarded with `to_regclass(...) IS NOT NULL`
--     and `to_jsonb(NEW)` schema-resilient extraction.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CENTRALIZED NOTIFICATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL DEFAULT 'status_update'
    CHECK (notification_type IN (
      'assignment',
      'approval_request',
      'approval_decision',
      'communication',
      'blocker_delay',
      'status_update',
      'deadline_alert',
      'confidential_escalation'
    )),
  source_module text NOT NULL DEFAULT 'projects',
  severity text NOT NULL DEFAULT 'normal'
    CHECK (severity IN ('low', 'normal', 'high', 'urgent')),
  related_table text,
  related_record_id uuid,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  action_route text,
  event_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast header count, dropdown fetch, and sidebar module counts
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_user_id, is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_module_unread
  ON public.notifications (recipient_user_id, source_module)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_project
  ON public.notifications (project_id)
  WHERE project_id IS NOT NULL;

-- Idempotency constraint: prevents duplicate notifications for the same event/recipient
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_recipient_event_key
  ON public.notifications (recipient_user_id, event_key)
  WHERE event_key IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. ROW-LEVEL SECURITY & ANTI-TAMPER UPDATE GUARD
-- ------------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.notifications FROM authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;

-- Helper: active profile check (self-contained, no recursion)
CREATE OR REPLACE FUNCTION public.notif_user_is_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.status = 'active'::public.user_status
  );
$$;

REVOKE ALL ON FUNCTION public.notif_user_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notif_user_is_active(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    AND public.notif_user_is_active(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update read state of own notifications" ON public.notifications;
CREATE POLICY "Users can update read state of own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    AND public.notif_user_is_active(auth.uid())
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
    AND public.notif_user_is_active(auth.uid())
  );

-- Anti-tamper BEFORE UPDATE trigger: recipients may ONLY change `is_read` and `read_at`
CREATE OR REPLACE FUNCTION public.guard_notification_recipient_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND current_user IN ('authenticated', 'anon') THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
      OR NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.message IS DISTINCT FROM OLD.message
      OR NEW.notification_type IS DISTINCT FROM OLD.notification_type
      OR NEW.source_module IS DISTINCT FROM OLD.source_module
      OR NEW.severity IS DISTINCT FROM OLD.severity
      OR NEW.related_table IS DISTINCT FROM OLD.related_table
      OR NEW.related_record_id IS DISTINCT FROM OLD.related_record_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.action_route IS DISTINCT FROM OLD.action_route
      OR NEW.event_key IS DISTINCT FROM OLD.event_key
      OR NEW.metadata IS DISTINCT FROM OLD.metadata
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Only notification read status may be updated by recipients';
    END IF;
  END IF;

  IF NEW.is_read = true AND OLD.is_read = false AND NEW.read_at IS NULL THEN
    NEW.read_at := now();
  ELSIF NEW.is_read = false THEN
    NEW.read_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_notification_recipient_update ON public.notifications;
CREATE TRIGGER trg_guard_notification_recipient_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_notification_recipient_update();

-- ------------------------------------------------------------------------------
-- 3. TRUSTED INTERNAL EMITTER FUNCTIONS (NOT CALLABLE DIRECTLY BY CLIENTS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_create_notification(
  p_recipient_user_id uuid,
  p_actor_user_id uuid,
  p_title text,
  p_message text,
  p_notification_type text DEFAULT 'status_update',
  p_source_module text DEFAULT 'projects',
  p_severity text DEFAULT 'normal',
  p_related_table text DEFAULT NULL,
  p_related_record_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_action_route text DEFAULT NULL,
  p_event_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_project_name text;
  v_project_code text;
  v_meta jsonb;
BEGIN
  IF p_recipient_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Skip self-notification when actor is the same user (except explicit deadline alerts)
  IF p_actor_user_id IS NOT NULL
     AND p_recipient_user_id = p_actor_user_id
     AND p_notification_type <> 'deadline_alert'
  THEN
    RETURN NULL;
  END IF;

  -- Deliver only to active registered accounts
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_recipient_user_id
      AND p.status = 'active'::public.user_status
  ) THEN
    RETURN NULL;
  END IF;

  v_meta := COALESCE(p_metadata, '{}'::jsonb);

  IF p_project_id IS NOT NULL AND NOT (v_meta ? 'project_name') THEN
    SELECT pr.name, pr.project_code
      INTO v_project_name, v_project_code
    FROM public.projects pr
    WHERE pr.id = p_project_id;

    IF v_project_name IS NOT NULL THEN
      v_meta := v_meta || jsonb_build_object(
        'project_name', v_project_name,
        'project_code', COALESCE(v_project_code, '')
      );
    END IF;
  END IF;

  INSERT INTO public.notifications (
    recipient_user_id,
    actor_user_id,
    title,
    message,
    notification_type,
    source_module,
    severity,
    related_table,
    related_record_id,
    project_id,
    action_route,
    event_key,
    metadata
  )
  VALUES (
    p_recipient_user_id,
    p_actor_user_id,
    left(trim(p_title), 180),
    left(trim(p_message), 500),
    p_notification_type,
    p_source_module,
    p_severity,
    p_related_table,
    p_related_record_id,
    p_project_id,
    p_action_route,
    p_event_key,
    v_meta
  )
  ON CONFLICT (recipient_user_id, event_key) WHERE event_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_create_notification(
  uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, jsonb
) FROM PUBLIC;

-- Notify all active users holding any of the given role slugs (with optional exclusion for conflict-of-interest)
DROP FUNCTION IF EXISTS public.internal_notify_roles(
  text[], uuid, text, text, text, text, text, text, uuid, uuid, text, text, jsonb
);

CREATE OR REPLACE FUNCTION public.internal_notify_roles(
  p_role_slugs text[],
  p_actor_user_id uuid,
  p_title text,
  p_message text,
  p_notification_type text DEFAULT 'status_update',
  p_source_module text DEFAULT 'projects',
  p_severity text DEFAULT 'normal',
  p_related_table text DEFAULT NULL,
  p_related_record_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_action_route text DEFAULT NULL,
  p_event_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_count integer := 0;
BEGIN
  IF p_role_slugs IS NULL OR array_length(p_role_slugs, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_uid IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE r.slug = ANY(p_role_slugs)
      AND p.status = 'active'::public.user_status
      AND (p_exclude_user_id IS NULL OR ur.user_id <> p_exclude_user_id)
  LOOP
    IF public.internal_create_notification(
      v_uid,
      p_actor_user_id,
      p_title,
      p_message,
      p_notification_type,
      p_source_module,
      p_severity,
      p_related_table,
      p_related_record_id,
      p_project_id,
      p_action_route,
      p_event_key,
      p_metadata
    ) IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_notify_roles(
  text[], uuid, text, text, text, text, text, text, uuid, uuid, text, text, jsonb, uuid
) FROM PUBLIC;

-- Notify ONLY authorized client portal users linked to the project
-- Respects granular authority flags AND subcontract pricing confidentiality
DROP FUNCTION IF EXISTS public.internal_notify_project_clients(
  uuid, text, uuid, text, text, text, text, text, text, uuid, text, text, jsonb
);

CREATE OR REPLACE FUNCTION public.internal_notify_project_clients(
  p_project_id uuid,
  p_required_authority text,
  p_actor_user_id uuid,
  p_title text,
  p_message text,
  p_notification_type text DEFAULT 'communication',
  p_source_module text DEFAULT 'client_portal',
  p_severity text DEFAULT 'normal',
  p_related_table text DEFAULT NULL,
  p_related_record_id uuid DEFAULT NULL,
  p_action_route text DEFAULT '/client-portal',
  p_event_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_exclude_hidden_subcontract boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_count integer := 0;
BEGIN
  IF p_project_id IS NULL OR to_regclass('public.client_project_access') IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_uid IN
    SELECT DISTINCT COALESCE(cpa.user_id, cc.user_id) AS resolved_user_id
    FROM public.client_project_access cpa
    LEFT JOIN public.client_contacts cc ON cc.id = cpa.client_contact_id
    JOIN public.profiles p ON p.id = COALESCE(cpa.user_id, cc.user_id)
    WHERE cpa.project_id = p_project_id
      AND cpa.is_active = true
      AND COALESCE(cc.is_active, true) = true
      AND p.status = 'active'::public.user_status
      AND (
        p_exclude_hidden_subcontract = false
        OR COALESCE(cpa.hide_subcontract_pricing, true) = false
      )
      AND (
        p_required_authority IS NULL
        OR (p_required_authority = 'view_commercial' AND cpa.can_view_commercial = true)
        OR (p_required_authority = 'view_financials' AND cpa.can_view_financials = true)
        OR (p_required_authority = 'approve_quotations' AND cpa.can_approve_quotations = true)
        OR (p_required_authority = 'approve_specifications' AND cpa.can_approve_specifications = true)
        OR (p_required_authority = 'approve_variations' AND cpa.can_approve_variations = true)
        OR (p_required_authority = 'acknowledge_completions' AND cpa.can_acknowledge_completions = true)
        OR (p_required_authority = 'approve_payments' AND cpa.can_approve_payments = true)
        OR (p_required_authority = 'submit_requests' AND cpa.can_submit_requests_complaints = true)
      )
  LOOP
    IF public.internal_create_notification(
      v_uid,
      p_actor_user_id,
      p_title,
      p_message,
      p_notification_type,
      p_source_module,
      p_severity,
      p_related_table,
      p_related_record_id,
      p_project_id,
      p_action_route,
      p_event_key,
      p_metadata
    ) IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_notify_project_clients(
  uuid, text, uuid, text, text, text, text, text, text, uuid, text, text, jsonb, boolean
) FROM PUBLIC;

-- ------------------------------------------------------------------------------
-- 4. AUTHENTICATED USER RPCs (READ STATE & IDEMPOTENT DEADLINE CHECK)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.notifications
  SET is_read = true,
      read_at = COALESCE(read_at, now())
  WHERE id = p_notification_id
    AND recipient_user_id = auth.uid();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_source_module text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.notifications
  SET is_read = true,
      read_at = now()
  WHERE recipient_user_id = auth.uid()
    AND is_read = false
    AND (p_source_module IS NULL OR source_module = p_source_module);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(text) TO authenticated;

-- Idempotent deadline / overdue checker scoped strictly to the signed-in user
CREATE OR REPLACE FUNCTION public.check_overdue_and_upcoming_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today text := to_char(CURRENT_DATE, 'YYYY-MM-DD');
  v_created integer := 0;
  v_rec record;
  v_is_leadership boolean := false;
  v_has_task_due_date boolean := false;
  v_has_task_assigned_to boolean := false;
BEGIN
  IF v_uid IS NULL OR NOT public.notif_user_is_active(v_uid) THEN
    RETURN 0;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_uid
      AND r.slug IN ('management', 'executive_director', 'admin')
  ) INTO v_is_leadership;

  -- A. Upcoming or overdue Work Package milestones for responsible supervisor or leadership
  IF to_regclass('public.work_package_milestones') IS NOT NULL
     AND to_regclass('public.project_work_packages') IS NOT NULL
  THEN
    FOR v_rec IN
      SELECT
        m.id AS milestone_id,
        m.title AS milestone_title,
        m.planned_date,
        wp.id AS package_id,
        wp.project_id,
        wp.title AS package_title,
        wp.responsible_supervisor_id
      FROM public.work_package_milestones m
      JOIN public.project_work_packages wp ON wp.id = m.work_package_id
      WHERE m.status NOT IN ('completed', 'verified')
        AND m.planned_date IS NOT NULL
        AND m.planned_date <= (CURRENT_DATE + INTERVAL '2 days')::date
        AND (wp.responsible_supervisor_id = v_uid OR v_is_leadership)
      LIMIT 15
    LOOP
      IF public.internal_create_notification(
        v_uid,
        NULL,
        CASE
          WHEN v_rec.planned_date < CURRENT_DATE THEN 'Overdue Work Package Milestone'
          ELSE 'Upcoming Work Package Milestone'
        END,
        format(
          '%s (%s) target date is %s.',
          v_rec.milestone_title,
          v_rec.package_title,
          to_char(v_rec.planned_date, 'DD Mon YYYY')
        ),
        'deadline_alert',
        'work_packages',
        CASE WHEN v_rec.planned_date < CURRENT_DATE THEN 'high' ELSE 'normal' END,
        'work_package_milestones',
        v_rec.milestone_id,
        v_rec.project_id,
        'work_packages',
        format('wp_milestone_due:%s:%s', v_rec.milestone_id, v_today),
        jsonb_build_object('work_package_id', v_rec.package_id)
      ) IS NOT NULL THEN
        v_created := v_created + 1;
      END IF;
    END LOOP;
  END IF;

  -- B. Overdue work packages for responsible supervisor or leadership
  --    Actual project_work_packages.status enum:
  --    planned, in_progress, ready_for_inspection, verified, released, handed_over, on_hold
  IF to_regclass('public.project_work_packages') IS NOT NULL THEN
    FOR v_rec IN
      SELECT
        wp.id AS package_id,
        wp.project_id,
        wp.title AS package_title,
        wp.planned_end_date
      FROM public.project_work_packages wp
      WHERE wp.status NOT IN ('verified', 'released', 'handed_over')
        AND wp.planned_end_date IS NOT NULL
        AND wp.planned_end_date < CURRENT_DATE
        AND (wp.responsible_supervisor_id = v_uid OR v_is_leadership)
      LIMIT 10
    LOOP
      IF public.internal_create_notification(
        v_uid,
        NULL,
        'Work Package Past Planned Completion',
        format(
          '"%s" passed its planned end date (%s) and requires review.',
          v_rec.package_title,
          to_char(v_rec.planned_end_date, 'DD Mon YYYY')
        ),
        'deadline_alert',
        'work_packages',
        'high',
        'project_work_packages',
        v_rec.package_id,
        v_rec.project_id,
        'work_packages',
        format('wp_overdue:%s:%s', v_rec.package_id, v_today),
        jsonb_build_object('work_package_id', v_rec.package_id)
      ) IS NOT NULL THEN
        v_created := v_created + 1;
      END IF;
    END LOOP;
  END IF;

  -- C. Overdue assigned project tasks (schema-safe check for legacy due_date/assigned_to)
  IF to_regclass('public.project_tasks') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'due_date'
    ) INTO v_has_task_due_date;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'assigned_to'
    ) INTO v_has_task_assigned_to;

    IF v_has_task_due_date AND v_has_task_assigned_to THEN
      FOR v_rec IN
        EXECUTE $q$
          SELECT
            t.id AS task_id,
            t.project_id,
            COALESCE(NULLIF(to_jsonb(t)->>'title', ''), NULLIF(to_jsonb(t)->>'task_name', ''), 'Project Task') AS task_title,
            t.due_date::date AS due_date
          FROM public.project_tasks t
          WHERE t.assigned_to = $1
            AND t.due_date IS NOT NULL
            AND t.due_date::date < CURRENT_DATE
            AND lower(COALESCE(t.status::text, '')) NOT IN ('completed', 'verified', 'closed', 'cancelled')
          LIMIT 10
        $q$
        USING v_uid
      LOOP
        IF public.internal_create_notification(
          v_uid,
          NULL,
          'Overdue Assigned Task',
          format(
            'Task "%s" passed its due date (%s). Please update progress or escalate.',
            v_rec.task_title,
            to_char(v_rec.due_date, 'DD Mon YYYY')
          ),
          'deadline_alert',
          'tasks',
          'high',
          'project_tasks',
          v_rec.task_id,
          v_rec.project_id,
          'tasks',
          format('task_overdue:%s:%s', v_rec.task_id, v_today),
          jsonb_build_object('due_date', v_rec.due_date)
        ) IS NOT NULL THEN
          v_created := v_created + 1;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.check_overdue_and_upcoming_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_overdue_and_upcoming_notifications() TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. TRUSTED EVENT TRIGGER FUNCTIONS
-- ------------------------------------------------------------------------------

-- 5.1 Project Tasks (assignment, reassignment, completion/review handover)
CREATE OR REPLACE FUNCTION public.trg_notify_project_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_assignee uuid := NULLIF(v_new->>'assigned_to', '')::uuid;
  v_old_assignee uuid := NULLIF(v_old->>'assigned_to', '')::uuid;
  v_actor uuid := COALESCE(auth.uid(), NULLIF(v_new->>'created_by', '')::uuid, NULLIF(v_new->>'assigned_by', '')::uuid);
  v_project_id uuid := NULLIF(v_new->>'project_id', '')::uuid;
  v_title text := COALESCE(NULLIF(v_new->>'title', ''), NULLIF(v_new->>'task_name', ''), 'Project Task');
  v_status text := lower(COALESCE(v_new->>'status', ''));
  v_old_status text := lower(COALESCE(v_old->>'status', ''));
BEGIN
  IF v_assignee IS NOT NULL AND (TG_OP = 'INSERT' OR v_assignee IS DISTINCT FROM v_old_assignee) THEN
    PERFORM public.internal_create_notification(
      v_assignee,
      v_actor,
      CASE WHEN TG_OP = 'INSERT' THEN 'New Task Assigned' ELSE 'Task Reassigned to You' END,
      format('You have been assigned "%s". Review specifications and deliverables.', v_title),
      'assignment',
      'tasks',
      'normal',
      'project_tasks',
      NEW.id,
      v_project_id,
      'tasks',
      format('task_assign:%s:%s:%s', NEW.id, v_assignee, COALESCE(v_new->>'updated_at', v_new->>'created_at', 'init')),
      jsonb_build_object('task_status', v_status)
    );
  END IF;

  IF TG_OP = 'UPDATE' AND v_status IS DISTINCT FROM v_old_status AND v_status IN ('submitted_for_review', 'completed', 'awaiting_verification') THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'admin', 'technical'],
      v_actor,
      'Task Handover Ready for Review',
      format('Task "%s" changed status to %s.', v_title, replace(v_status, '_', ' ')),
      'approval_request',
      'tasks',
      'normal',
      'project_tasks',
      NEW.id,
      v_project_id,
      'tasks',
      format('task_status:%s:%s:%s', NEW.id, v_status, COALESCE(v_new->>'updated_at', now()::text)),
      jsonb_build_object('task_status', v_status)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.2 Work Packages (supervisor assignment, inspection readiness, approval workflow, delay status)
--     Verified columns on public.project_work_packages:
--     id, project_id, package_code, title, status, responsible_supervisor_id,
--     inspection_status, approval_status, delay_status, client_visible, created_by, updated_at
CREATE OR REPLACE FUNCTION public.trg_notify_work_packages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.created_by);
  v_sup uuid := NEW.responsible_supervisor_id;
  v_old_sup uuid := CASE WHEN TG_OP = 'UPDATE' THEN OLD.responsible_supervisor_id ELSE NULL END;
  v_title text := COALESCE(NULLIF(NEW.title, ''), 'Work Package');
  v_code text := COALESCE(NULLIF(NEW.package_code, ''), '');
  v_label text := CASE WHEN v_code <> '' THEN format('%s — %s', v_code, v_title) ELSE v_title END;
  v_status text := lower(COALESCE(NEW.status, ''));
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.status, '')) ELSE '' END;
  v_insp text := lower(COALESCE(NEW.inspection_status, ''));
  v_old_insp text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.inspection_status, '')) ELSE '' END;
  v_appr text := lower(COALESCE(NEW.approval_status, ''));
  v_old_appr text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.approval_status, '')) ELSE '' END;
  v_delay text := lower(COALESCE(NEW.delay_status, ''));
  v_old_delay text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.delay_status, '')) ELSE '' END;
BEGIN
  -- Supervisor assignment or reassignment
  IF v_sup IS NOT NULL AND (TG_OP = 'INSERT' OR v_sup IS DISTINCT FROM v_old_sup) THEN
    PERFORM public.internal_create_notification(
      v_sup,
      v_actor,
      CASE WHEN TG_OP = 'INSERT' THEN 'Work Package Assigned' ELSE 'Work Package Reassigned to You' END,
      format('You are assigned as responsible supervisor for %s.', v_label),
      'assignment',
      'work_packages',
      'normal',
      'project_work_packages',
      NEW.id,
      NEW.project_id,
      'work_packages',
      format('wp_sup:%s:%s:%s', NEW.id, v_sup, NEW.updated_at),
      jsonb_build_object('work_package_id', NEW.id, 'package_code', v_code)
    );
  END IF;

  -- Submitted for Technical Inspection
  IF (v_status = 'ready_for_inspection' AND v_status IS DISTINCT FROM v_old_status)
     OR (v_insp = 'scheduled' AND v_insp IS DISTINCT FROM v_old_insp)
  THEN
    PERFORM public.internal_notify_roles(
      ARRAY['technical', 'admin'],
      v_actor,
      'Work Package Ready for QC Inspection',
      format('%s has been submitted for technical quality inspection.', v_label),
      'approval_request',
      'technical_qc',
      'high',
      'project_work_packages',
      NEW.id,
      NEW.project_id,
      'work_packages',
      format('wp_insp:%s:%s:%s', NEW.id, v_insp, NEW.updated_at),
      jsonb_build_object('work_package_id', NEW.id)
    );
  END IF;

  -- QC snag identified -> notify supervisor & leadership
  IF v_insp = 'snag_identified' AND v_insp IS DISTINCT FROM v_old_insp THEN
    IF v_sup IS NOT NULL THEN
      PERFORM public.internal_create_notification(
        v_sup,
        v_actor,
        'QC Snag Identified on Work Package',
        format('%s recorded snags during technical inspection and requires rectification.', v_label),
        'blocker_delay',
        'work_packages',
        'high',
        'project_work_packages',
        NEW.id,
        NEW.project_id,
        'work_packages',
        format('wp_snag:%s:%s', NEW.id, NEW.updated_at),
        jsonb_build_object('work_package_id', NEW.id, 'inspection_status', v_insp)
      );
    END IF;
  END IF;

  -- Submitted for Management / Executive Approval
  IF v_appr = 'submitted_for_approval' AND v_appr IS DISTINCT FROM v_old_appr THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'admin'],
      v_actor,
      'Work Package Awaiting Approval',
      format('%s has been submitted for approval sign-off.', v_label),
      'approval_request',
      'work_packages',
      'high',
      'project_work_packages',
      NEW.id,
      NEW.project_id,
      'work_packages',
      format('wp_appr_req:%s:%s', NEW.id, NEW.updated_at),
      jsonb_build_object('work_package_id', NEW.id)
    );
  END IF;

  -- Approval decision -> notify responsible supervisor
  IF v_appr IN ('approved', 'rejected', 'revision_requested') AND v_appr IS DISTINCT FROM v_old_appr AND v_sup IS NOT NULL THEN
    PERFORM public.internal_create_notification(
      v_sup,
      v_actor,
      format('Work Package %s', initcap(replace(v_appr, '_', ' '))),
      format('%s approval status updated to %s.', v_label, replace(v_appr, '_', ' ')),
      'approval_decision',
      'work_packages',
      CASE WHEN v_appr IN ('rejected', 'revision_requested') THEN 'high' ELSE 'normal' END,
      'project_work_packages',
      NEW.id,
      NEW.project_id,
      'work_packages',
      format('wp_appr_dec:%s:%s:%s', NEW.id, v_appr, NEW.updated_at),
      jsonb_build_object('work_package_id', NEW.id, 'approval_status', v_appr)
    );
  END IF;

  -- Delay / blocked alert
  IF v_delay IN ('delayed', 'blocked') AND v_delay IS DISTINCT FROM v_old_delay THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'admin'],
      v_actor,
      format('Work Package %s', initcap(v_delay)),
      format('%s is marked %s and needs leadership review.', v_label, v_delay),
      'blocker_delay',
      'work_packages',
      CASE WHEN v_delay = 'blocked' THEN 'urgent' ELSE 'high' END,
      'project_work_packages',
      NEW.id,
      NEW.project_id,
      'work_packages',
      format('wp_delay:%s:%s:%s', NEW.id, v_delay, NEW.updated_at),
      jsonb_build_object('work_package_id', NEW.id, 'delay_status', v_delay)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.3 Work Package Milestones (verification chain & client visibility)
CREATE OR REPLACE FUNCTION public.trg_notify_work_package_milestones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.created_by);
  v_wp record;
  v_stage text := lower(COALESCE(NEW.verification_stage, ''));
  v_old_stage text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.verification_stage, '')) ELSE '' END;
BEGIN
  SELECT id, project_id, title, client_visible, responsible_supervisor_id
    INTO v_wp
  FROM public.project_work_packages
  WHERE id = NEW.work_package_id;

  IF v_wp.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_stage = 'reported_by_supervisor' AND v_stage IS DISTINCT FROM v_old_stage THEN
    PERFORM public.internal_notify_roles(
      ARRAY['technical', 'admin'],
      v_actor,
      'Work Package Milestone Reported Complete',
      format('Milestone "%s" (%s) was reported complete and awaits QC verification.', NEW.title, v_wp.title),
      'approval_request',
      'work_packages',
      'normal',
      'work_package_milestones',
      NEW.id,
      v_wp.project_id,
      'work_packages',
      format('wp_ms_rep:%s:%s', NEW.id, NEW.updated_at),
      jsonb_build_object('work_package_id', v_wp.id)
    );
  ELSIF v_stage = 'verified_completed' AND v_stage IS DISTINCT FROM v_old_stage THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director'],
      v_actor,
      'Work Package Milestone Verified',
      format('Milestone "%s" (%s) passed verification.', NEW.title, v_wp.title),
      'status_update',
      'work_packages',
      'normal',
      'work_package_milestones',
      NEW.id,
      v_wp.project_id,
      'work_packages',
      format('wp_ms_ver:%s:%s', NEW.id, NEW.updated_at),
      jsonb_build_object('work_package_id', v_wp.id)
    );

    IF COALESCE(v_wp.client_visible, false) = true AND COALESCE(NEW.client_visible, true) = true THEN
      PERFORM public.internal_notify_project_clients(
        v_wp.project_id,
        NULL,
        v_actor,
        'Project Milestone Verified',
        format('Milestone "%s" under %s has been verified complete.', NEW.title, v_wp.title),
        'status_update',
        'work_packages',
        'normal',
        'work_package_milestones',
        NEW.id,
        'work-packages',
        format('wp_ms_client:%s:%s', NEW.id, NEW.updated_at),
        jsonb_build_object('work_package_id', v_wp.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5.4 Work Package Blockers & Delays
CREATE OR REPLACE FUNCTION public.trg_notify_work_package_blockers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.created_by);
  v_wp record;
  v_severity text := CASE WHEN lower(COALESCE(NEW.severity, 'medium')) IN ('critical', 'high') THEN 'urgent' ELSE 'high' END;
  v_old_owner uuid := CASE WHEN TG_OP = 'UPDATE' THEN OLD.owner_user_id ELSE NULL END;
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.status, '')) ELSE '' END;
  v_status text := lower(COALESCE(NEW.status, 'open'));
BEGIN
  SELECT id, project_id, title, responsible_supervisor_id
    INTO v_wp
  FROM public.project_work_packages
  WHERE id = NEW.work_package_id;

  IF v_wp.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Notify blocker owner when assigned or reassigned
  IF NEW.owner_user_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.owner_user_id IS DISTINCT FROM v_old_owner) THEN
    PERFORM public.internal_create_notification(
      NEW.owner_user_id,
      v_actor,
      'Blocker / Corrective Action Assigned',
      format('You have been assigned blocker "%s" on %s.', NEW.title, v_wp.title),
      'assignment',
      'work_packages',
      v_severity,
      'work_package_blockers',
      NEW.id,
      v_wp.project_id,
      'work_packages',
      format('wp_blk_owner:%s:%s:%s', NEW.id, NEW.owner_user_id, NEW.updated_at),
      jsonb_build_object('work_package_id', v_wp.id, 'blocker_type', NEW.blocker_type)
    );
  END IF;

  -- Notify leadership & admin on new blocker or escalation
  IF TG_OP = 'INSERT' OR (v_status = 'escalated' AND v_status IS DISTINCT FROM v_old_status) THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'admin'],
      v_actor,
      CASE WHEN v_status = 'escalated' THEN 'Work Package Blocker Escalated' ELSE 'Work Package Delay / Blocker Logged' END,
      format('"%s" logged on %s (severity: %s).', NEW.title, v_wp.title, COALESCE(NEW.severity, 'medium')),
      'blocker_delay',
      'work_packages',
      v_severity,
      'work_package_blockers',
      NEW.id,
      v_wp.project_id,
      'work_packages',
      format('wp_blk_alert:%s:%s:%s', NEW.id, v_status, NEW.updated_at),
      jsonb_build_object('work_package_id', v_wp.id, 'blocker_type', NEW.blocker_type)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.5 Project Workforce Assignments (notifies assigned staff user via workforce_members.profile_id)
CREATE OR REPLACE FUNCTION public.trg_notify_project_workforce_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_actor uuid := COALESCE(auth.uid(), NULLIF(v_new->>'assigned_by', '')::uuid);
  v_project_id uuid := NULLIF(v_new->>'project_id', '')::uuid;
  v_wf_id uuid := NULLIF(v_new->>'workforce_member_id', '')::uuid;
  v_recipient uuid;
  v_project_name text;
BEGIN
  IF v_wf_id IS NULL OR v_project_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT wm.profile_id INTO v_recipient
  FROM public.workforce_members wm
  WHERE wm.id = v_wf_id;

  IF v_recipient IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pr.name INTO v_project_name
  FROM public.projects pr
  WHERE pr.id = v_project_id;

  PERFORM public.internal_create_notification(
    v_recipient,
    v_actor,
    'Assigned to Project',
    format('You have been assigned to project "%s". Open your dashboard to view details and schedule.', COALESCE(v_project_name, 'Active Project')),
    'assignment',
    'projects',
    'normal',
    'project_workforce_assignments',
    NEW.id,
    v_project_id,
    'projects',
    -- Shared daily deduplication key with trg_notify_project_members so auto-sync never double-notifies
    format('proj_assign:%s:%s:%s', v_project_id, v_recipient, to_char(CURRENT_DATE, 'YYYY-MM-DD')),
    jsonb_build_object('workforce_member_id', v_wf_id)
  );

  RETURN NEW;
END;
$$;

-- 5.5B Direct Project Members Assignment (deduplicated with project_workforce_assignments)
CREATE OR REPLACE FUNCTION public.trg_notify_project_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_actor uuid := auth.uid();
  v_project_id uuid := NULLIF(v_new->>'project_id', '')::uuid;
  v_recipient uuid := NULLIF(v_new->>'user_id', '')::uuid;
  v_project_name text;
BEGIN
  IF v_recipient IS NULL OR v_project_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pr.name INTO v_project_name
  FROM public.projects pr
  WHERE pr.id = v_project_id;

  PERFORM public.internal_create_notification(
    v_recipient,
    v_actor,
    'Assigned to Project',
    format('You have been assigned to project "%s". Open your dashboard to view details and schedule.', COALESCE(v_project_name, 'Active Project')),
    'assignment',
    'projects',
    'normal',
    'project_members',
    NULLIF(v_new->>'id', '')::uuid,
    v_project_id,
    'projects',
    format('proj_assign:%s:%s:%s', v_project_id, v_recipient, to_char(CURRENT_DATE, 'YYYY-MM-DD')),
    jsonb_build_object('project_role', COALESCE(v_new->>'role', ''))
  );

  RETURN NEW;
END;
$$;

-- 5.6 Client Quotations & Contracts
--     Verified columns: reference_no, title, prepared_by, status,
--     is_subcontract_confidential, project_id, updated_at
CREATE OR REPLACE FUNCTION public.trg_notify_client_quotations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.prepared_by);
  v_status text := lower(COALESCE(NEW.status, ''));
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.status, '')) ELSE '' END;
  v_label text := COALESCE(NULLIF(NEW.reference_no, ''), NULLIF(NEW.title, ''), 'Quotation');
BEGIN
  IF v_status = 'issued' AND v_status IS DISTINCT FROM v_old_status THEN
    PERFORM public.internal_notify_project_clients(
      NEW.project_id,
      'view_commercial',
      v_actor,
      'Quotation Issued for Your Review',
      format('%s has been issued and is ready for your review and approval.', v_label),
      'approval_request',
      'quotations',
      'high',
      'client_quotations_contracts',
      NEW.id,
      'quotations',
      format('quote_issued:%s:%s', NEW.id, NEW.updated_at),
      jsonb_build_object('reference_no', NEW.reference_no),
      COALESCE(NEW.is_subcontract_confidential, false)
    );
  ELSIF v_status IN ('accepted', 'declined', 'revision_requested', 'clarification_requested')
    AND v_status IS DISTINCT FROM v_old_status
  THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'admin', 'accounts'],
      v_actor,
      format('Client Quotation %s', initcap(replace(v_status, '_', ' '))),
      format('%s status was updated by the client to %s.', v_label, replace(v_status, '_', ' ')),
      'approval_decision',
      'approvals',
      CASE WHEN v_status IN ('declined', 'revision_requested') THEN 'high' ELSE 'normal' END,
      'client_quotations_contracts',
      NEW.id,
      NEW.project_id,
      'client_portal',
      format('quote_client_dec:%s:%s:%s', NEW.id, v_status, NEW.updated_at),
      jsonb_build_object('reference_no', NEW.reference_no, 'status', v_status)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.7 Project Specifications
--     Verified columns: spec_code, area_label, material_product, prepared_by, status, project_id, updated_at
CREATE OR REPLACE FUNCTION public.trg_notify_project_specifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.prepared_by);
  v_status text := lower(COALESCE(NEW.status, ''));
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.status, '')) ELSE '' END;
  v_label text := COALESCE(
    NULLIF(concat_ws(' — ', NULLIF(NEW.spec_code, ''), NULLIF(NEW.area_label, '')), ''),
    NULLIF(NEW.material_product, ''),
    'Project Specification'
  );
BEGIN
  IF v_status IN ('submitted', 'awaiting_approval') AND v_status IS DISTINCT FROM v_old_status THEN
    PERFORM public.internal_notify_project_clients(
      NEW.project_id,
      'approve_specifications',
      v_actor,
      'Specification Awaiting Approval',
      format('Specification "%s" has been submitted for your sign-off.', v_label),
      'approval_request',
      'specifications',
      'normal',
      'project_specifications',
      NEW.id,
      'brief',
      format('spec_sub:%s:%s', NEW.id, NEW.updated_at),
      jsonb_build_object('spec_code', NEW.spec_code, 'status', v_status)
    );
  ELSIF v_status IN ('approved', 'rejected') AND v_status IS DISTINCT FROM v_old_status THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'admin', 'technical'],
      v_actor,
      format('Specification %s', initcap(replace(v_status, '_', ' '))),
      format('Client updated specification "%s" to %s.', v_label, replace(v_status, '_', ' ')),
      'approval_decision',
      'client_portal',
      CASE WHEN v_status = 'rejected' THEN 'high' ELSE 'normal' END,
      'project_specifications',
      NEW.id,
      NEW.project_id,
      'client_portal',
      format('spec_dec:%s:%s:%s', NEW.id, v_status, NEW.updated_at),
      jsonb_build_object('spec_code', NEW.spec_code, 'status', v_status)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.8 Project Variations
--     Verified columns: variation_ref, title, requested_by, technical_assessor_id,
--     workflow_stage, project_id, updated_at
CREATE OR REPLACE FUNCTION public.trg_notify_project_variations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.requested_by);
  v_stage text := lower(COALESCE(NEW.workflow_stage, ''));
  v_old_stage text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.workflow_stage, '')) ELSE '' END;
  v_label text := COALESCE(NULLIF(NEW.variation_ref, ''), NEW.title, 'Variation');
BEGIN
  IF TG_OP = 'INSERT' OR v_stage IS DISTINCT FROM v_old_stage THEN
    IF v_stage = 'request_received' THEN
      PERFORM public.internal_notify_roles(
        ARRAY['management', 'executive_director', 'admin', 'technical'],
        v_actor,
        'New Variation Request Submitted',
        format('%s (%s) requires technical and commercial assessment.', v_label, NEW.title),
        'approval_request',
        'variations',
        'high',
        'project_variations',
        NEW.id,
        NEW.project_id,
        'client_portal',
        format('var_req:%s:%s', NEW.id, NEW.updated_at),
        jsonb_build_object('variation_ref', NEW.variation_ref, 'workflow_stage', v_stage)
      );
    ELSIF v_stage = 'cost_time_assessed' THEN
      PERFORM public.internal_notify_roles(
        ARRAY['management', 'executive_director'],
        v_actor,
        'Variation Ready for Internal Sign-Off',
        format('%s has been cost/time assessed and awaits management release to client.', v_label),
        'approval_request',
        'approvals',
        'high',
        'project_variations',
        NEW.id,
        NEW.project_id,
        'client_portal',
        format('var_assessed:%s:%s', NEW.id, NEW.updated_at),
        jsonb_build_object('variation_ref', NEW.variation_ref, 'workflow_stage', v_stage)
      );
    ELSIF v_stage = 'awaiting_client_approval' THEN
      PERFORM public.internal_notify_project_clients(
        NEW.project_id,
        'approve_variations',
        v_actor,
        'Variation Awaiting Your Approval',
        format('%s ("%s") is ready for your formal approval.', v_label, NEW.title),
        'approval_request',
        'variations',
        'high',
        'project_variations',
        NEW.id,
        'variations',
        format('var_client:%s:%s', NEW.id, NEW.updated_at),
        jsonb_build_object('variation_ref', NEW.variation_ref, 'workflow_stage', v_stage)
      );
    ELSIF v_stage IN ('client_approved', 'client_rejected', 'disputed') THEN
      PERFORM public.internal_notify_roles(
        ARRAY['management', 'executive_director', 'admin', 'accounts'],
        v_actor,
        format('Variation %s', initcap(replace(v_stage, '_', ' '))),
        format('%s was marked %s.', v_label, replace(v_stage, '_', ' ')),
        'approval_decision',
        'variations',
        CASE WHEN v_stage IN ('client_rejected', 'disputed') THEN 'urgent' ELSE 'normal' END,
        'project_variations',
        NEW.id,
        NEW.project_id,
        'client_portal',
        format('var_dec:%s:%s:%s', NEW.id, v_stage, NEW.updated_at),
        jsonb_build_object('variation_ref', NEW.variation_ref, 'workflow_stage', v_stage)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5.9 Project Area Completions
--     Verified columns: completion_ref, area_location, site_supervisor_id, qc_inspector_id,
--     workflow_status, client_acknowledgement_status, project_id, updated_at
CREATE OR REPLACE FUNCTION public.trg_notify_area_completions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.site_supervisor_id, NEW.qc_inspector_id);
  v_wf text := lower(COALESCE(NEW.workflow_status, ''));
  v_old_wf text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.workflow_status, '')) ELSE '' END;
  v_ack text := lower(COALESCE(NEW.client_acknowledgement_status, ''));
  v_old_ack text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.client_acknowledgement_status, '')) ELSE '' END;
BEGIN
  IF v_wf = 'ready_for_qc' AND (TG_OP = 'INSERT' OR v_wf IS DISTINCT FROM v_old_wf) THEN
    PERFORM public.internal_notify_roles(
      ARRAY['technical', 'admin'],
      v_actor,
      'Area Completion Ready for QC',
      format('Area "%s" (%s) was submitted for technical quality inspection.', NEW.area_location, NEW.completion_ref),
      'approval_request',
      'technical_qc',
      'normal',
      'project_area_completions',
      NEW.id,
      NEW.project_id,
      'technical_qc',
      format('area_qc:%s:%s', NEW.id, NEW.updated_at),
      jsonb_build_object('area_location', NEW.area_location, 'completion_ref', NEW.completion_ref)
    );
  ELSIF v_wf = 'qc_failed_snag' AND v_wf IS DISTINCT FROM v_old_wf AND NEW.site_supervisor_id IS NOT NULL THEN
    PERFORM public.internal_create_notification(
      NEW.site_supervisor_id,
      v_actor,
      'Area Completion Failed QC — Snags Logged',
      format('Area "%s" (%s) failed QC inspection and requires snag rectification.', NEW.area_location, NEW.completion_ref),
      'blocker_delay',
      'completions',
      'high',
      'project_area_completions',
      NEW.id,
      NEW.project_id,
      'completions',
      format('area_snag:%s:%s', NEW.id, NEW.updated_at),
      jsonb_build_object('area_location', NEW.area_location, 'completion_ref', NEW.completion_ref)
    );
  ELSIF v_wf = 'submitted_for_acknowledgement' AND v_wf IS DISTINCT FROM v_old_wf THEN
    PERFORM public.internal_notify_project_clients(
      NEW.project_id,
      'acknowledge_completions',
      v_actor,
      'Completed Area Ready for Acknowledgement',
      format('Completed area "%s" (%s) has passed QC and awaits your acknowledgement.', NEW.area_location, NEW.completion_ref),
      'approval_request',
      'completions',
      'normal',
      'project_area_completions',
      NEW.id,
      'completions',
      format('area_client:%s:%s', NEW.id, NEW.updated_at),
      jsonb_build_object('area_location', NEW.area_location, 'completion_ref', NEW.completion_ref)
    );
  END IF;

  IF v_ack IN ('acknowledged', 'rejected') AND v_ack IS DISTINCT FROM v_old_ack THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'admin', 'technical'],
      v_actor,
      format('Area Completion %s by Client', initcap(v_ack)),
      format('Client %s completion for area "%s" (%s).', v_ack, NEW.area_location, NEW.completion_ref),
      'approval_decision',
      'completions',
      CASE WHEN v_ack = 'rejected' THEN 'high' ELSE 'normal' END,
      'project_area_completions',
      NEW.id,
      NEW.project_id,
      'client_portal',
      format('area_ack:%s:%s:%s', NEW.id, v_ack, NEW.updated_at),
      jsonb_build_object('acknowledgement', v_ack, 'completion_ref', NEW.completion_ref)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.10 Pre-Work Surface Inspections
--      Verified columns: inspection_ref, area_label, inspector_id, client_decision,
--      client_visible, project_id, updated_at
CREATE OR REPLACE FUNCTION public.trg_notify_prework_inspections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.inspector_id);
  v_dec text := lower(COALESCE(NEW.client_decision, 'pending'));
  v_old_dec text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.client_decision, 'pending')) ELSE '' END;
  v_vis boolean := COALESCE(NEW.client_visible, false);
  v_old_vis boolean := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.client_visible, false) ELSE false END;
BEGIN
  IF v_vis = true AND v_dec = 'pending' AND (TG_OP = 'INSERT' OR v_old_vis = false) THEN
    PERFORM public.internal_notify_project_clients(
      NEW.project_id,
      NULL,
      v_actor,
      'Pre-Work Surface Inspection Requires Decision',
      format('Inspection findings for "%s" (%s) have been shared and await your decision.', NEW.area_label, NEW.inspection_ref),
      'approval_request',
      'technical_qc',
      'high',
      'prework_surface_inspections',
      NEW.id,
      'brief',
      format('prework_client:%s:%s', NEW.id, NEW.updated_at),
      jsonb_build_object('area_label', NEW.area_label, 'inspection_ref', NEW.inspection_ref)
    );
  ELSIF v_dec <> 'pending' AND v_dec IS DISTINCT FROM v_old_dec THEN
    PERFORM public.internal_notify_roles(
      ARRAY['technical', 'management', 'executive_director', 'admin'],
      v_actor,
      'Client Pre-Work Inspection Decision Recorded',
      format('Client recorded "%s" for pre-work inspection on "%s" (%s).', replace(v_dec, '_', ' '), NEW.area_label, NEW.inspection_ref),
      'approval_decision',
      'technical_qc',
      CASE WHEN v_dec IN ('hold_work', 'variation_requested') THEN 'high' ELSE 'normal' END,
      'prework_surface_inspections',
      NEW.id,
      NEW.project_id,
      'technical_qc',
      format('prework_dec:%s:%s:%s', NEW.id, v_dec, NEW.updated_at),
      jsonb_build_object('client_decision', v_dec, 'inspection_ref', NEW.inspection_ref)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.11 Client Requests & Complaints (STRICT CONFIDENTIALITY & CONFLICT-OF-INTEREST ISOLATION)
--      Verified columns: reference_no, record_kind ('request' | 'complaint'), subject,
--      priority, submitted_by_user_id, is_confidential_management, subject_user_id,
--      assigned_to_user_id, status, project_id, updated_at
CREATE OR REPLACE FUNCTION public.trg_notify_client_requests_complaints()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.submitted_by_user_id);
  v_status text := lower(COALESCE(NEW.status, 'open'));
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.status, '')) ELSE '' END;
  v_old_assigned uuid := CASE WHEN TG_OP = 'UPDATE' THEN OLD.assigned_to_user_id ELSE NULL END;
  v_ref text := COALESCE(NULLIF(NEW.reference_no, ''), 'REQ');
  v_kind text := COALESCE(NULLIF(NEW.record_kind, ''), 'request');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_confidential_management, false) = true THEN
      -- STRICT CONFIDENTIALITY:
      -- 1) ONLY Management & Executive Director receive this alert.
      -- 2) Explicitly exclude NEW.subject_user_id even if they hold any role.
      -- 3) Redacted generic message — NEVER expose subject, description, or subject_user_id.
      PERFORM public.internal_notify_roles(
        ARRAY['management', 'executive_director'],
        v_actor,
        'Confidential Management Escalation Received',
        format('A confidential client escalation (%s) was submitted directly to executive leadership. Open the secure management inbox to review.', v_ref),
        'confidential_escalation',
        'requests_complaints',
        'urgent',
        'client_requests_complaints',
        NEW.id,
        NEW.project_id,
        'client_portal',
        format('conf_complaint:%s', NEW.id),
        jsonb_build_object('reference_no', v_ref, 'is_confidential', true),
        NEW.subject_user_id
      );
    ELSE
      PERFORM public.internal_notify_roles(
        ARRAY['management', 'executive_director', 'admin'],
        v_actor,
        format('New Client %s (%s)', initcap(v_kind), v_ref),
        format('"%s" was submitted via the Client Portal.', COALESCE(NEW.subject, 'Client enquiry')),
        'communication',
        'requests_complaints',
        CASE WHEN lower(COALESCE(NEW.priority, 'normal')) IN ('high', 'urgent') THEN 'high' ELSE 'normal' END,
        'client_requests_complaints',
        NEW.id,
        NEW.project_id,
        'client_portal',
        format('client_req:%s', NEW.id),
        jsonb_build_object('reference_no', v_ref, 'record_kind', v_kind),
        NEW.subject_user_id
      );
    END IF;
  END IF;

  -- Non-confidential assignment to a specific staff member (never notify subject_user_id)
  IF COALESCE(NEW.is_confidential_management, false) = false
     AND NEW.assigned_to_user_id IS NOT NULL
     AND (NEW.subject_user_id IS NULL OR NEW.assigned_to_user_id <> NEW.subject_user_id)
     AND (TG_OP = 'INSERT' OR NEW.assigned_to_user_id IS DISTINCT FROM v_old_assigned)
  THEN
    PERFORM public.internal_create_notification(
      NEW.assigned_to_user_id,
      v_actor,
      format('Client %s Assigned (%s)', initcap(v_kind), v_ref),
      format('You have been assigned "%s" for follow-up.', COALESCE(NEW.subject, v_ref)),
      'assignment',
      'requests_complaints',
      CASE WHEN lower(COALESCE(NEW.priority, 'normal')) IN ('high', 'urgent') THEN 'high' ELSE 'normal' END,
      'client_requests_complaints',
      NEW.id,
      NEW.project_id,
      'client_portal',
      format('client_req_assign:%s:%s:%s', NEW.id, NEW.assigned_to_user_id, NEW.updated_at),
      jsonb_build_object('reference_no', v_ref, 'record_kind', v_kind)
    );
  END IF;

  -- Status updates back to submitting client
  IF TG_OP = 'UPDATE' AND v_status IS DISTINCT FROM v_old_status AND v_status IN ('in_review', 'action_in_progress', 'awaiting_client', 'resolved', 'closed') THEN
    IF NEW.submitted_by_user_id IS NOT NULL THEN
      PERFORM public.internal_create_notification(
        NEW.submitted_by_user_id,
        v_actor,
        format('Update on %s', v_ref),
        CASE
          WHEN COALESCE(NEW.is_confidential_management, false) = true
            THEN format('Your confidential escalation (%s) status has been updated to %s.', v_ref, replace(v_status, '_', ' '))
          ELSE format('Your %s (%s) status has been updated to %s.', v_kind, v_ref, replace(v_status, '_', ' '))
        END,
        'communication',
        'requests_complaints',
        CASE WHEN v_status = 'awaiting_client' THEN 'high' ELSE 'normal' END,
        'client_requests_complaints',
        NEW.id,
        NEW.project_id,
        'requests',
        format('client_req_upd:%s:%s:%s', NEW.id, v_status, NEW.updated_at),
        jsonb_build_object('reference_no', v_ref, 'status', v_status)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5.12 Client Weekly Summaries
--      Verified columns: summary_title, week_start_date, week_end_date,
--      prepared_by, reviewed_by, released_by, status, project_id, updated_at
CREATE OR REPLACE FUNCTION public.trg_notify_client_weekly_summaries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.released_by, NEW.prepared_by);
  v_status text := lower(COALESCE(NEW.status, ''));
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.status, '')) ELSE '' END;
BEGIN
  IF v_status = 'released' AND v_status IS DISTINCT FROM v_old_status THEN
    PERFORM public.internal_notify_project_clients(
      NEW.project_id,
      NULL,
      v_actor,
      'New Weekly Progress Summary Released',
      format('A new weekly progress summary ("%s") has been published for your project.', COALESCE(NEW.summary_title, 'Project Update')),
      'communication',
      'client_portal',
      'normal',
      'client_weekly_summaries',
      NEW.id,
      'overview',
      format('weekly_sum:%s', NEW.id),
      jsonb_build_object('week_end_date', NEW.week_end_date)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.13 Project Progress Updates (delays, pending client decisions, technical concerns)
--      Verified columns: project_id, work_package_id, title, activity_type,
--      verification_stage, reported_by, client_visible, updated_at
CREATE OR REPLACE FUNCTION public.trg_notify_project_progress_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.reported_by);
  v_act text := lower(COALESCE(NEW.activity_type, ''));
  v_stage text := lower(COALESCE(NEW.verification_stage, ''));
  v_old_stage text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.verification_stage, '')) ELSE '' END;
BEGIN
  IF TG_OP = 'INSERT' AND v_act IN ('delay', 'technical_concern') THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'admin', 'technical'],
      v_actor,
      CASE WHEN v_act = 'delay' THEN 'Project Delay Reported' ELSE 'Technical Concern Logged' END,
      format('"%s" was logged on the project timeline.', NEW.title),
      'blocker_delay',
      'projects',
      'high',
      'project_progress_updates',
      NEW.id,
      NEW.project_id,
      'projects',
      format('prog_issue:%s:%s', NEW.id, v_act),
      jsonb_build_object('activity_type', v_act)
    );
  END IF;

  IF COALESCE(NEW.client_visible, true) = true
     AND (
       (TG_OP = 'INSERT' AND v_act = 'pending_client_decision')
       OR (v_stage = 'verified_completed' AND v_stage IS DISTINCT FROM v_old_stage)
     )
  THEN
    PERFORM public.internal_notify_project_clients(
      NEW.project_id,
      NULL,
      v_actor,
      CASE WHEN v_act = 'pending_client_decision' THEN 'Project Update Requires Your Decision' ELSE 'Verified Project Progress Update' END,
      format('"%s" has been posted to your project timeline.', NEW.title),
      CASE WHEN v_act = 'pending_client_decision' THEN 'approval_request' ELSE 'status_update' END,
      'client_portal',
      CASE WHEN v_act = 'pending_client_decision' THEN 'high' ELSE 'normal' END,
      'project_progress_updates',
      NEW.id,
      'overview',
      format('prog_client:%s:%s:%s', NEW.id, v_act, v_stage),
      jsonb_build_object('activity_type', v_act, 'verification_stage', v_stage)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.14 Subsequent Damage / Rework Incidents
--      Verified columns: incident_ref, project_id, area_location, reported_by,
--      liability_status, resolution_status, client_visible, updated_at
CREATE OR REPLACE FUNCTION public.trg_notify_subsequent_damage_incidents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.reported_by);
  v_old_liab text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.liability_status, '')) ELSE '' END;
  v_liab text := lower(COALESCE(NEW.liability_status, 'under_assessment'));
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'admin', 'technical'],
      v_actor,
      format('Post-Completion Damage Incident Logged (%s)', NEW.incident_ref),
      format('Damage incident reported on completed area "%s" requiring inspection and liability assessment.', NEW.area_location),
      'blocker_delay',
      'completions',
      'urgent',
      'subsequent_damage_incidents',
      NEW.id,
      NEW.project_id,
      'client_portal',
      format('dmg_inc:%s', NEW.id),
      jsonb_build_object('incident_ref', NEW.incident_ref, 'area_location', NEW.area_location)
    );
  END IF;

  IF COALESCE(NEW.client_visible, true) = true
     AND v_liab = 'evidence_shared'
     AND v_liab IS DISTINCT FROM v_old_liab
  THEN
    PERFORM public.internal_notify_project_clients(
      NEW.project_id,
      NULL,
      v_actor,
      format('Site Condition Evidence Shared (%s)', NEW.incident_ref),
      format('Evidence regarding area "%s" has been shared for your review.', NEW.area_location),
      'communication',
      'completions',
      'high',
      'subsequent_damage_incidents',
      NEW.id,
      'completions',
      format('dmg_client:%s:%s', NEW.id, NEW.updated_at),
      jsonb_build_object('incident_ref', NEW.incident_ref)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.15 Walk-in Customer Service Requests
--      Verified columns: request_number, customer_name, service_type, status,
--      assigned_to, created_by, converted_project_id, updated_at
CREATE OR REPLACE FUNCTION public.trg_notify_service_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.created_by);
  v_old_assigned uuid := CASE WHEN TG_OP = 'UPDATE' THEN OLD.assigned_to ELSE NULL END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'admin'],
      v_actor,
      format('New Service Request (%s)', NEW.request_number),
      format('%s requested %s. Review and assign inspection or quotation.', NEW.customer_name, NEW.service_type),
      'communication',
      'service_requests',
      'normal',
      'service_requests',
      NEW.id,
      NEW.converted_project_id,
      'service_requests',
      format('svc_req_new:%s', NEW.id),
      jsonb_build_object('request_number', NEW.request_number, 'service_type', NEW.service_type)
    );
  END IF;

  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM v_old_assigned) THEN
    PERFORM public.internal_create_notification(
      NEW.assigned_to,
      v_actor,
      format('Service Request Assigned (%s)', NEW.request_number),
      format('You have been assigned service request %s for %s (%s).', NEW.request_number, NEW.customer_name, NEW.service_type),
      'assignment',
      'service_requests',
      'normal',
      'service_requests',
      NEW.id,
      NEW.converted_project_id,
      'service_requests',
      format('svc_req_assign:%s:%s:%s', NEW.id, NEW.assigned_to, NEW.updated_at),
      jsonb_build_object('request_number', NEW.request_number)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.16 Client Approval Authority Delegations
--      Verified columns: client_id, project_id, delegator_contact_id, delegate_contact_id,
--      starts_at, ends_at, status, created_by, revoked_by, updated_at
CREATE OR REPLACE FUNCTION public.trg_notify_client_authority_delegations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.revoked_by, NEW.created_by);
  v_delegate_uid uuid;
  v_delegator_name text;
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN lower(COALESCE(OLD.status, '')) ELSE '' END;
  v_status text := lower(COALESCE(NEW.status, 'active'));
BEGIN
  SELECT cc.user_id INTO v_delegate_uid
  FROM public.client_contacts cc
  WHERE cc.id = NEW.delegate_contact_id
    AND cc.is_active = true;

  IF v_delegate_uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cc.full_name INTO v_delegator_name
  FROM public.client_contacts cc
  WHERE cc.id = NEW.delegator_contact_id;

  IF TG_OP = 'INSERT' AND v_status = 'active' THEN
    PERFORM public.internal_create_notification(
      v_delegate_uid,
      v_actor,
      'Approval Authority Delegated to You',
      format(
        '%s delegated temporary approval authority to you until %s.',
        COALESCE(v_delegator_name, 'An authorized contact'),
        to_char(NEW.ends_at, 'DD Mon YYYY')
      ),
      'assignment',
      'client_portal',
      'high',
      'client_authority_delegations',
      NEW.id,
      NEW.project_id,
      'overview',
      format('delegation_active:%s', NEW.id),
      jsonb_build_object('ends_at', NEW.ends_at)
    );
  ELSIF TG_OP = 'UPDATE' AND v_status = 'revoked' AND v_status IS DISTINCT FROM v_old_status THEN
    PERFORM public.internal_create_notification(
      v_delegate_uid,
      v_actor,
      'Delegated Approval Authority Revoked',
      format('Temporary approval authority delegated by %s has been revoked.', COALESCE(v_delegator_name, 'the delegator')),
      'status_update',
      'client_portal',
      'normal',
      'client_authority_delegations',
      NEW.id,
      NEW.project_id,
      'overview',
      format('delegation_revoked:%s:%s', NEW.id, NEW.updated_at),
      jsonb_build_object('status', v_status)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.17 Material Requests
CREATE OR REPLACE FUNCTION public.trg_notify_material_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_actor uuid := COALESCE(auth.uid(), NULLIF(v_new->>'requested_by', '')::uuid, NULLIF(v_new->>'created_by', '')::uuid);
  v_requester uuid := COALESCE(NULLIF(v_new->>'requested_by', '')::uuid, NULLIF(v_new->>'created_by', '')::uuid);
  v_project_id uuid := NULLIF(v_new->>'project_id', '')::uuid;
  v_status text := lower(COALESCE(v_new->>'status', 'pending'));
  v_old_status text := lower(COALESCE(v_old->>'status', ''));
  v_ref text := COALESCE(NULLIF(v_new->>'request_number', ''), NULLIF(v_new->>'request_code', ''), 'Material Request');
BEGIN
  IF (TG_OP = 'INSERT' AND v_status IN ('pending', 'submitted', 'awaiting_approval'))
     OR (TG_OP = 'UPDATE' AND v_status IN ('pending', 'submitted', 'awaiting_approval') AND v_status IS DISTINCT FROM v_old_status)
  THEN
    PERFORM public.internal_notify_roles(
      ARRAY['procurement', 'management', 'executive_director'],
      v_actor,
      'Material Request Submitted',
      format('%s has been submitted and awaits procurement/approval review.', v_ref),
      'approval_request',
      'procurement',
      'normal',
      'material_requests',
      NEW.id,
      v_project_id,
      'procurement',
      format('mat_req_sub:%s:%s', NEW.id, v_status),
      jsonb_build_object('status', v_status)
    );
  ELSIF TG_OP = 'UPDATE' AND v_status IN ('approved', 'rejected', 'fulfilled', 'dispatched') AND v_status IS DISTINCT FROM v_old_status AND v_requester IS NOT NULL THEN
    PERFORM public.internal_create_notification(
      v_requester,
      v_actor,
      format('Material Request %s', initcap(v_status)),
      format('%s has been marked %s.', v_ref, v_status),
      'approval_decision',
      'materials',
      CASE WHEN v_status = 'rejected' THEN 'high' ELSE 'normal' END,
      'material_requests',
      NEW.id,
      v_project_id,
      'materials',
      format('mat_req_dec:%s:%s:%s', NEW.id, v_status, COALESCE(v_new->>'updated_at', now()::text)),
      jsonb_build_object('status', v_status)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.18 Purchase Orders
CREATE OR REPLACE FUNCTION public.trg_notify_purchase_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_actor uuid := COALESCE(auth.uid(), NULLIF(v_new->>'created_by', '')::uuid);
  v_project_id uuid := NULLIF(v_new->>'project_id', '')::uuid;
  v_status text := lower(COALESCE(v_new->>'status', 'draft'));
  v_old_status text := lower(COALESCE(v_old->>'status', ''));
  v_ref text := COALESCE(NULLIF(v_new->>'po_number', ''), NULLIF(v_new->>'order_number', ''), 'Purchase Order');
BEGIN
  IF (TG_OP = 'INSERT' AND v_status IN ('pending', 'submitted', 'awaiting_approval', 'pending_approval'))
     OR (TG_OP = 'UPDATE' AND v_status IN ('pending', 'submitted', 'awaiting_approval', 'pending_approval') AND v_status IS DISTINCT FROM v_old_status)
  THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'accounts'],
      v_actor,
      'Purchase Order Awaiting Approval',
      format('%s requires approval and financial verification.', v_ref),
      'approval_request',
      'finance',
      'high',
      'purchase_orders',
      NEW.id,
      v_project_id,
      'finance',
      format('po_pending:%s:%s', NEW.id, v_status),
      jsonb_build_object('status', v_status)
    );
  ELSIF TG_OP = 'UPDATE' AND v_status IN ('approved', 'issued', 'rejected') AND v_status IS DISTINCT FROM v_old_status THEN
    PERFORM public.internal_notify_roles(
      ARRAY['procurement', 'accounts'],
      v_actor,
      format('Purchase Order %s', initcap(v_status)),
      format('%s status changed to %s.', v_ref, v_status),
      'approval_decision',
      'procurement',
      CASE WHEN v_status = 'rejected' THEN 'high' ELSE 'normal' END,
      'purchase_orders',
      NEW.id,
      v_project_id,
      'procurement',
      format('po_dec:%s:%s:%s', NEW.id, v_status, COALESCE(v_new->>'updated_at', now()::text)),
      jsonb_build_object('status', v_status)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 5.19 Overtime Requests
CREATE OR REPLACE FUNCTION public.trg_notify_overtime_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_actor uuid := COALESCE(auth.uid(), NULLIF(v_new->>'requested_by', '')::uuid);
  v_project_id uuid := NULLIF(v_new->>'project_id', '')::uuid;
  v_wf_id uuid := NULLIF(v_new->>'workforce_member_id', '')::uuid;
  v_worker_uid uuid;
  v_status text := lower(COALESCE(v_new->>'status', 'pending'));
  v_old_status text := lower(COALESCE(v_old->>'status', ''));
BEGIN
  IF TG_OP = 'INSERT' AND v_status IN ('pending', 'submitted') THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'admin'],
      v_actor,
      'Overtime Request Pending Approval',
      format('An overtime request (%s hrs) was submitted for review.', COALESCE(v_new->>'requested_hours', '0')),
      'approval_request',
      'overtime',
      'normal',
      'overtime_requests',
      NEW.id,
      v_project_id,
      'overtime',
      format('ot_sub:%s', NEW.id),
      jsonb_build_object('status', v_status)
    );
  ELSIF TG_OP = 'UPDATE' AND v_status IN ('approved', 'rejected') AND v_status IS DISTINCT FROM v_old_status THEN
    IF v_wf_id IS NOT NULL THEN
      SELECT wm.profile_id INTO v_worker_uid
      FROM public.workforce_members wm
      WHERE wm.id = v_wf_id;
    END IF;
    v_worker_uid := COALESCE(v_worker_uid, NULLIF(v_new->>'requested_by', '')::uuid);

    IF v_worker_uid IS NOT NULL THEN
      PERFORM public.internal_create_notification(
        v_worker_uid,
        v_actor,
        format('Overtime Request %s', initcap(v_status)),
        format('Your overtime request (%s hrs) was %s.', COALESCE(v_new->>'requested_hours', '0'), v_status),
        'approval_decision',
        'overtime',
        'normal',
        'overtime_requests',
        NEW.id,
        v_project_id,
        'overtime',
        format('ot_dec:%s:%s', NEW.id, v_status),
        jsonb_build_object('status', v_status)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5.20 Technical Inspections
CREATE OR REPLACE FUNCTION public.trg_notify_technical_inspections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_actor uuid := COALESCE(auth.uid(), NULLIF(v_new->>'created_by', '')::uuid);
  v_inspector uuid := NULLIF(v_new->>'inspector_id', '')::uuid;
  v_old_inspector uuid := NULLIF(v_old->>'inspector_id', '')::uuid;
  v_project_id uuid := NULLIF(v_new->>'project_id', '')::uuid;
  v_type text := COALESCE(NULLIF(v_new->>'inspection_type', ''), 'Technical Inspection');
  v_result text := lower(COALESCE(v_new->>'result', v_new->>'status', ''));
  v_old_result text := lower(COALESCE(v_old->>'result', v_old->>'status', ''));
BEGIN
  IF v_inspector IS NOT NULL AND (TG_OP = 'INSERT' OR v_inspector IS DISTINCT FROM v_old_inspector) THEN
    PERFORM public.internal_create_notification(
      v_inspector,
      v_actor,
      'Technical Inspection Assigned',
      format('You have been assigned "%s".', v_type),
      'assignment',
      'technical_qc',
      'normal',
      'technical_inspections',
      NEW.id,
      v_project_id,
      'technical_qc',
      format('tech_insp_assign:%s:%s', NEW.id, v_inspector),
      jsonb_build_object('inspection_type', v_type)
    );
  END IF;

  IF v_result IN ('failed', 'fail', 'critical') AND (TG_OP = 'INSERT' OR v_result IS DISTINCT FROM v_old_result) THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director', 'admin'],
      v_actor,
      'Critical / Failed Technical Inspection',
      format('"%s" recorded a %s result and requires immediate attention.', v_type, v_result),
      'blocker_delay',
      'technical_qc',
      'urgent',
      'technical_inspections',
      NEW.id,
      v_project_id,
      'technical_qc',
      format('tech_insp_fail:%s:%s', NEW.id, v_result),
      jsonb_build_object('result', v_result)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. CONDITIONALLY ATTACH TRIGGERS TO EXISTING TABLES
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.project_tasks') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_project_tasks ON public.project_tasks;
    CREATE TRIGGER trg_notify_project_tasks
      AFTER INSERT OR UPDATE ON public.project_tasks
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_project_tasks();
  END IF;

  IF to_regclass('public.project_work_packages') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_work_packages ON public.project_work_packages;
    CREATE TRIGGER trg_notify_work_packages
      AFTER INSERT OR UPDATE ON public.project_work_packages
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_work_packages();
  END IF;

  IF to_regclass('public.work_package_milestones') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_work_package_milestones ON public.work_package_milestones;
    CREATE TRIGGER trg_notify_work_package_milestones
      AFTER INSERT OR UPDATE ON public.work_package_milestones
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_work_package_milestones();
  END IF;

  IF to_regclass('public.work_package_blockers') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_work_package_blockers ON public.work_package_blockers;
    CREATE TRIGGER trg_notify_work_package_blockers
      AFTER INSERT OR UPDATE ON public.work_package_blockers
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_work_package_blockers();
  END IF;

  IF to_regclass('public.project_workforce_assignments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_project_workforce_assignments ON public.project_workforce_assignments;
    CREATE TRIGGER trg_notify_project_workforce_assignments
      AFTER INSERT ON public.project_workforce_assignments
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_project_workforce_assignments();
  END IF;

  IF to_regclass('public.project_members') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_project_members ON public.project_members;
    CREATE TRIGGER trg_notify_project_members
      AFTER INSERT ON public.project_members
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_project_members();
  END IF;

  IF to_regclass('public.client_quotations_contracts') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_client_quotations ON public.client_quotations_contracts;
    CREATE TRIGGER trg_notify_client_quotations
      AFTER INSERT OR UPDATE ON public.client_quotations_contracts
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_client_quotations();
  END IF;

  IF to_regclass('public.project_specifications') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_project_specifications ON public.project_specifications;
    CREATE TRIGGER trg_notify_project_specifications
      AFTER INSERT OR UPDATE ON public.project_specifications
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_project_specifications();
  END IF;

  IF to_regclass('public.project_variations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_project_variations ON public.project_variations;
    CREATE TRIGGER trg_notify_project_variations
      AFTER INSERT OR UPDATE ON public.project_variations
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_project_variations();
  END IF;

  IF to_regclass('public.project_area_completions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_area_completions ON public.project_area_completions;
    CREATE TRIGGER trg_notify_area_completions
      AFTER INSERT OR UPDATE ON public.project_area_completions
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_area_completions();
  END IF;

  IF to_regclass('public.prework_surface_inspections') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_prework_inspections ON public.prework_surface_inspections;
    CREATE TRIGGER trg_notify_prework_inspections
      AFTER INSERT OR UPDATE ON public.prework_surface_inspections
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_prework_inspections();
  END IF;

  IF to_regclass('public.client_requests_complaints') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_client_requests_complaints ON public.client_requests_complaints;
    CREATE TRIGGER trg_notify_client_requests_complaints
      AFTER INSERT OR UPDATE ON public.client_requests_complaints
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_client_requests_complaints();
  END IF;

  IF to_regclass('public.client_weekly_summaries') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_client_weekly_summaries ON public.client_weekly_summaries;
    CREATE TRIGGER trg_notify_client_weekly_summaries
      AFTER INSERT OR UPDATE ON public.client_weekly_summaries
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_client_weekly_summaries();
  END IF;

  IF to_regclass('public.project_progress_updates') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_project_progress_updates ON public.project_progress_updates;
    CREATE TRIGGER trg_notify_project_progress_updates
      AFTER INSERT OR UPDATE ON public.project_progress_updates
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_project_progress_updates();
  END IF;

  IF to_regclass('public.subsequent_damage_incidents') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_subsequent_damage_incidents ON public.subsequent_damage_incidents;
    CREATE TRIGGER trg_notify_subsequent_damage_incidents
      AFTER INSERT OR UPDATE ON public.subsequent_damage_incidents
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_subsequent_damage_incidents();
  END IF;

  IF to_regclass('public.service_requests') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_service_requests ON public.service_requests;
    CREATE TRIGGER trg_notify_service_requests
      AFTER INSERT OR UPDATE ON public.service_requests
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_service_requests();
  END IF;

  IF to_regclass('public.client_authority_delegations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_client_authority_delegations ON public.client_authority_delegations;
    CREATE TRIGGER trg_notify_client_authority_delegations
      AFTER INSERT OR UPDATE ON public.client_authority_delegations
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_client_authority_delegations();
  END IF;

  IF to_regclass('public.material_requests') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_material_requests ON public.material_requests;
    CREATE TRIGGER trg_notify_material_requests
      AFTER INSERT OR UPDATE ON public.material_requests
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_material_requests();
  END IF;

  IF to_regclass('public.purchase_orders') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_purchase_orders ON public.purchase_orders;
    CREATE TRIGGER trg_notify_purchase_orders
      AFTER INSERT OR UPDATE ON public.purchase_orders
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_purchase_orders();
  END IF;

  IF to_regclass('public.overtime_requests') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_overtime_requests ON public.overtime_requests;
    CREATE TRIGGER trg_notify_overtime_requests
      AFTER INSERT OR UPDATE ON public.overtime_requests
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_overtime_requests();
  END IF;

  IF to_regclass('public.technical_inspections') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_technical_inspections ON public.technical_inspections;
    CREATE TRIGGER trg_notify_technical_inspections
      AFTER INSERT OR UPDATE ON public.technical_inspections
      FOR EACH ROW EXECUTE FUNCTION public.trg_notify_technical_inspections();
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7. ENABLE REALTIME PUBLICATION FOR `public.notifications`
-- ------------------------------------------------------------------------------
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'notifications'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

COMMIT;
