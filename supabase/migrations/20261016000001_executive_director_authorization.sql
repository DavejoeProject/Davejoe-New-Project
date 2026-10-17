
BEGIN;

-- ============================================================
-- DAVEJOE SECURITY HARDENING
-- Management / CEO + Executive Director authorization
-- Ordinary users: own first_name and last_name only
-- ============================================================

-- ============================================================
-- 1. HARDEN TABLE AND COLUMN PRIVILEGES
-- ============================================================

-- Revoke existing table-level privileges from client-facing roles.
REVOKE ALL PRIVILEGES ON TABLE
  public.profiles,
  public.roles,
  public.permissions,
  public.user_roles,
  public.role_permissions
FROM anon, authenticated;

-- Revoke existing column-level privileges on ALL five tables.
-- Table-level REVOKE alone does not remove column-level grants.
DO $block$
DECLARE
  v_table text;
  v_columns text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'profiles',
    'roles',
    'permissions',
    'user_roles',
    'role_permissions'
  ]
  LOOP
    SELECT string_agg(
      format('%I', column_name),
      ', ' ORDER BY ordinal_position
    )
    INTO v_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = v_table;

    IF v_columns IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES (%s) ON TABLE public.%I FROM anon, authenticated',
        v_columns,
        v_table
      );
    END IF;
  END LOOP;
END;
$block$;

-- Authenticated users can read data subject to RLS policies.
GRANT SELECT ON TABLE
  public.profiles,
  public.user_roles,
  public.roles,
  public.permissions,
  public.role_permissions
TO authenticated;

-- Direct profile updates are limited to first and last names.
-- RLS still restricts users to their own profile.
GRANT UPDATE (first_name, last_name)
ON TABLE public.profiles
TO authenticated;

-- Administrative role and permission changes remain subject to RLS.
GRANT INSERT, UPDATE, DELETE ON TABLE
  public.user_roles,
  public.roles,
  public.permissions,
  public.role_permissions
TO authenticated;



-- 3. HELPER: DETECT PROTECTED LEADERSHIP ACCOUNTS
CREATE OR REPLACE FUNCTION public.is_leadership_user(
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = target_user_id
      AND lower(r.slug) IN ('management', 'executive_director')
  );
$function$;

REVOKE ALL ON FUNCTION public.is_leadership_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_leadership_user(uuid)
  TO authenticated, service_role;


-- 4. PROFILES: REPLACE THE EXISTING POLICIES
DROP POLICY IF EXISTS "Management can manage profiles"
  ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"
  ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"
  ON public.profiles;
DROP POLICY IF EXISTS "Leadership can manage profiles"
  ON public.profiles;

CREATE POLICY "Users and leadership can view permitted profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
);

CREATE POLICY "Users can update own name"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Leadership can update non-protected profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND NOT public.is_leadership_user(id)
  )
)
WITH CHECK (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND NOT public.is_leadership_user(id)
  )
);


-- 5. USER ROLES: ONLY LEADERSHIP MAY ADMINISTER ASSIGNMENTS
DROP POLICY IF EXISTS "Management can manage user roles"
  ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their roles"
  ON public.user_roles;
DROP POLICY IF EXISTS "Leadership can manage user roles"
  ON public.user_roles;

CREATE POLICY "Users can view own role assignments"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
);

CREATE POLICY "Leadership can assign permitted roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND NOT public.is_leadership_user(user_id)
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = user_roles.role_id
        AND lower(r.slug) NOT IN ('management', 'executive_director')
    )
  )
);

CREATE POLICY "Leadership can update permitted assignments"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND NOT public.is_leadership_user(user_id)
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = user_roles.role_id
        AND lower(r.slug) NOT IN ('management', 'executive_director')
    )
  )
)
WITH CHECK (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND NOT public.is_leadership_user(user_id)
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = user_roles.role_id
        AND lower(r.slug) NOT IN ('management', 'executive_director')
    )
  )
);

CREATE POLICY "Leadership can remove permitted assignments"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND NOT public.is_leadership_user(user_id)
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = user_roles.role_id
        AND lower(r.slug) NOT IN ('management', 'executive_director')
    )
  )
);


-- 6. ROLES: EXECUTIVE DIRECTOR MAY MANAGE NON-LEADERSHIP ROLES
DROP POLICY IF EXISTS "Management can manage roles" ON public.roles;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.roles;

CREATE POLICY "Authenticated users can view roles"
ON public.roles
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Leadership can create permitted roles"
ON public.roles
FOR INSERT TO authenticated
WITH CHECK (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND lower(slug) NOT IN ('management', 'executive_director')
AND lower(name) NOT IN (
  'management / ceo',
  'executive director',
  'executive director ' || chr(8212) || ' business operations & strategy'
)
);

CREATE POLICY "Leadership can update permitted roles"
ON public.roles
FOR UPDATE TO authenticated
USING (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND lower(slug) NOT IN ('management', 'executive_director')
  )
)
WITH CHECK (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND lower(slug) NOT IN ('management', 'executive_director')
    AND lower(name) NOT IN (
      'management / ceo',
      'executive director',
       'executive director ' || chr(8212) || ' business operations & strategy'
  )
);


CREATE POLICY "Leadership can delete permitted roles"
ON public.roles
FOR DELETE TO authenticated
USING (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND lower(slug) NOT IN ('management', 'executive_director')
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.role_id = roles.id
    )
  )
);




-- 7. PERMISSIONS: LEADERSHIP MAY MANAGE THE CATALOGUE,
-- BUT EXECUTIVE DIRECTOR CANNOT ALTER PERMISSIONS USED
-- BY EITHER PROTECTED LEADERSHIP ROLE.

DROP POLICY IF EXISTS "Management can manage permissions"
  ON public.permissions;
DROP POLICY IF EXISTS "Authenticated users can view permissions"
  ON public.permissions;
DROP POLICY IF EXISTS "Leadership can create permissions"
  ON public.permissions;
DROP POLICY IF EXISTS "Leadership can update permissions"
  ON public.permissions;
DROP POLICY IF EXISTS "Leadership can delete permissions"
  ON public.permissions;

CREATE POLICY "Authenticated users can view permissions"
ON public.permissions
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Leadership can create permissions"
ON public.permissions
FOR INSERT TO authenticated
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
);

CREATE POLICY "Leadership can update unprotected permissions"
ON public.permissions
FOR UPDATE TO authenticated
USING (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND NOT EXISTS (
      SELECT 1
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
      WHERE rp.permission_id = permissions.id
        AND (
  lower(r.slug) IN ('management', 'executive_director')
  OR lower(r.name) IN (
    'management / ceo',
    'executive director',
    'executive director ' || chr(8212) || ' business operations & strategy'
  )
);
    )
  )
)
WITH CHECK (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND NOT EXISTS (
      SELECT 1
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
      WHERE rp.permission_id = permissions.id
        AND lower(r.slug) IN ('management', 'executive_director')
    )
  )
);

CREATE POLICY "Leadership can delete unprotected permissions"
ON public.permissions
FOR DELETE TO authenticated
USING (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND NOT EXISTS (
      SELECT 1
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id
      WHERE rp.permission_id = permissions.id
        AND lower(r.slug) IN ('management', 'executive_director')
    )
  )
);


-- 8. ROLE PERMISSIONS: EXECUTIVE DIRECTOR CANNOT CHANGE
--    PERMISSION MAPPINGS FOR EITHER LEADERSHIP ROLE
DROP POLICY IF EXISTS "Management can manage role permissions"
  ON public.role_permissions;
DROP POLICY IF EXISTS "Authenticated users can view role permissions"
  ON public.role_permissions;

CREATE POLICY "Authenticated users can view role permissions"
ON public.role_permissions
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Leadership can add permitted role permissions"
ON public.role_permissions
FOR INSERT TO authenticated
WITH CHECK (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND lower(r.slug) NOT IN ('management', 'executive_director')
    )
  )
);

CREATE POLICY "Leadership can update permitted role permissions"
ON public.role_permissions
FOR UPDATE TO authenticated
USING (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND lower(r.slug) NOT IN ('management', 'executive_director')
    )
  )
)
WITH CHECK (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND lower(r.slug) NOT IN ('management', 'executive_director')
    )
  )
);

CREATE POLICY "Leadership can remove permitted role permissions"
ON public.role_permissions
FOR DELETE TO authenticated
USING (
  public.auth_has_role('management')
  OR (
    public.auth_has_role('executive_director')
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND lower(r.slug) NOT IN ('management', 'executive_director')
    )
  )
);


-- 9. REMOVE SENSITIVE ADMINISTRATIVE PERMISSIONS FROM ADMIN.
-- Preserve operational permissions and the Admin's normal workflow access.
DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.slug = 'admin'
  AND lower(p.module) IN ('users', 'roles', 'permissions', 'audit');

-- 9. ENSURE THE EXECUTIVE DIRECTOR HAS THE EXISTING ADMIN
--    PERMISSION CODES THAT ARE PRESENT IN THIS CATALOGUE.
--    This does not grant the Admin / Coordinator role.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p
  ON p.code IN (
    'users.view',
    'users.create',
    'users.update',
    'users.suspend',
    'roles.view',
    'roles.assign',
    'audit.view'
  )
WHERE r.slug = 'executive_director'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
