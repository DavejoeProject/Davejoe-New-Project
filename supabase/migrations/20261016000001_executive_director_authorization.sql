
BEGIN;

-- Davejoe authorization hardening.
-- Only Management/CEO and Executive Director administer users,
-- roles, permissions, and role assignments.

-- 1. Use active accounts and stable role slugs for authorization.
CREATE OR REPLACE FUNCTION public.has_role(requested_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND (
        lower(r.slug) = lower(requested_role)
        OR lower(r.name) = lower(requested_role)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(requested_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions perm ON perm.id = rp.permission_id
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND (
        perm.code = requested_permission
        OR perm.name = requested_permission
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(text)
  TO authenticated, service_role;


-- 2. PROFILES: users can access their own profile;
-- leadership can administer profiles.

DROP POLICY IF EXISTS "Management can manage profiles"
  ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"
  ON public.profiles;

CREATE POLICY "Leadership can manage profiles"
ON public.profiles
FOR ALL TO authenticated
USING (
  public.has_role('management')
  OR public.has_role('executive_director')
)
WITH CHECK (
  public.has_role('management')
  OR public.has_role('executive_director')
);

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

-- Keep the existing own-profile UPDATE policy intact.


-- 3. ROLES: leadership can view and manage the role catalogue.
-- Other users can see only role definitions assigned to themselves.

DROP POLICY IF EXISTS "Authenticated users can view roles"
  ON public.roles;
DROP POLICY IF EXISTS "Management can manage roles"
  ON public.roles;

CREATE POLICY "Leadership can manage roles"
ON public.roles
FOR ALL TO authenticated
USING (
  public.has_role('management')
  OR public.has_role('executive_director')
)
WITH CHECK (
  public.has_role('management')
  OR public.has_role('executive_director')
);

CREATE POLICY "Users can view their own role definitions"
ON public.roles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.role_id = roles.id
      AND ur.user_id = auth.uid()
  )
);


-- 4. PERMISSIONS: only leadership can view or manage the catalogue.

DROP POLICY IF EXISTS "Authenticated users can view permissions"
  ON public.permissions;
DROP POLICY IF EXISTS "Management can manage permissions"
  ON public.permissions;

CREATE POLICY "Leadership can manage permissions"
ON public.permissions
FOR ALL TO authenticated
USING (
  public.has_role('management')
  OR public.has_role('executive_director')
)
WITH CHECK (
  public.has_role('management')
  OR public.has_role('executive_director')
);


-- 5. USER ROLES: users can see their own assignments;
-- only leadership can create, change, or remove assignments.

DROP POLICY IF EXISTS "Management can manage user roles"
  ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their roles"
  ON public.user_roles;

CREATE POLICY "Leadership can manage user roles"
ON public.user_roles
FOR ALL TO authenticated
USING (
  public.has_role('management')
  OR public.has_role('executive_director')
)
WITH CHECK (
  public.has_role('management')
  OR public.has_role('executive_director')
);

CREATE POLICY "Users can view their own role assignments"
ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());


-- 6. ROLE PERMISSIONS: only leadership can view or manage mappings.

DROP POLICY IF EXISTS "Authenticated users can view role permissions"
  ON public.role_permissions;
DROP POLICY IF EXISTS "Management can manage role permissions"
  ON public.role_permissions;

CREATE POLICY "Leadership can manage role permissions"
ON public.role_permissions
FOR ALL TO authenticated
USING (
  public.has_role('management')
  OR public.has_role('executive_director')
)
WITH CHECK (
  public.has_role('management')
  OR public.has_role('executive_director')
);


-- 7. Remove sensitive administrative grants from Admin.
-- Operational permissions are preserved.

DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.slug = 'admin'
  AND lower(p.module) IN ('users', 'roles', 'permissions', 'audit');


-- 8. Grant existing administrative permissions to both leaders.
-- Does not create new permission catalogue entries or roles.

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('management', 'executive_director')
  AND p.code IN (
    'users.view',
    'users.create',
    'users.update',
    'users.suspend',
    'roles.view',
    'roles.assign',
    'audit.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
