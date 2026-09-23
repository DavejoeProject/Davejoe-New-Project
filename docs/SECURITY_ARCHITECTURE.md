# Davejoe Management Tool — Security Architecture & Hardening Guide

## 1. Executive Summary & Defense-in-Depth Model

The Davejoe Management Tool is an enterprise resource and project management system designed for **Davejoe Interiors** and its associated enterprises (including **Rehab Global Resources**). The application handles highly confidential business records: executive financials, client accounts, project valuations, bills of quantities, subcontractor compensation, workforce registries, procurement workflows, quality control certifications, and operational audits.

Security cannot be treated as a cosmetic frontend concern. A core tenet of this architecture is **Defense in Depth**:
1. **Supabase Auth**: Cryptographic identity authentication via Supabase Auth (JWTs, session tokens, secure password hashing with bcrypt/argon2).
2. **Database Authorization**: PostgreSQL Row Level Security (RLS) as the immutable authorization boundary.
3. **Role-Based Access Control (RBAC)**: Managed via database-backed tables (`roles`, `user_roles`).
4. **Permission-Based Access Control (PBAC)**: Granular permissions (`module.action`) mapped via `permissions` and `role_permissions`.
5. **Security Definer Isolation**: Strict schema-qualified functions with immutable `search_path = public, pg_temp` preventing search path hijacking.
6. **Immutable Audit Trail**: Append-only `audit_logs` table with RLS denying row modifications or deletions.
7. **Client-Side Defense**: Route protection, UI conditional rendering (for UX only), zero trust of client storage (`localStorage` / cookies), strict input validation, and sanitization.

---

## 2. Threat Modeling & Attack Vectors Defended

| Threat / Attack Vector | Severity | Vulnerability Description | Applied Hardening Measure |
| :--- | :--- | :--- | :--- |
| **Client Role Spoofing** | **CRITICAL** | User modifies JavaScript state or `localStorage` to claim `Management / CEO` role. | Roles and permissions are strictly evaluated from database `user_roles` and PostgreSQL RLS on every database query using `auth.uid()`. `localStorage` values are never trusted for authorization. |
| **Privilege Escalation via Profile fields** | **HIGH** | User updates profile `job_title` to match executive role string. | `authService.ts` strictly queries `user_roles` joined to `roles`. Profile fields (`job_title`) are strictly informational and ignored during role authorization. |
| **Search Path Hijacking in Functions** | **HIGH** | Malicious actors create objects in unconstrained schema in `SECURITY DEFINER` functions. | All database functions explicitly specify `SET search_path = public, pg_temp` and qualify all table references. |
| **Tampering with Row Ownership (`user_id` spoofing)** | **HIGH** | User submits arbitrary `created_by` or `user_id` UUID in request payload. | PostgreSQL triggers and RLS policies enforce `created_by = auth.uid()` and reject mismatches regardless of payload. |
| **Bypassing UI via Direct REST / PostgREST** | **CRITICAL** | User discovers Supabase REST URL and executes curl/Postman queries directly. | All business tables enforce strict RLS policies. Even with a valid user JWT, PostgREST queries only return rows permitted by RLS policies. |
| **Audit Log Tampering** | **CRITICAL** | Rogue employee deletes log entries or modifies audit trail history. | `audit_logs` table has RLS enabled with NO UPDATE and NO DELETE policies for any non-superuser role. Trigger prevents modifications. |
| **Broad RLS Grants (`USING (true)`)** | **HIGH** | Developer uses open policy allowing any logged-in user to see all projects/financials. | Every policy explicitly evaluates `auth.uid()`, assigned role, project membership, or specific permission via `auth_has_permission()`. |
| **Secret Key Leakage in Client Bundle** | **CRITICAL** | Service role key or database password bundled via `VITE_` variable into public JS. | Strict isolation: only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) in client. All privileged operations run via database RLS or backend Edge Functions. |
| **XSS & Injection** | **MEDIUM** | User injects malicious script or HTML into comments, forms, or text inputs. | React default escaping enforced, zero `dangerouslySetInnerHTML`, strict input validation, and character sanitization via `src/lib/validation.ts`. |

---

## 3. Architecture Overview

```
                      +---------------------------------------+
                      |         Browser / React Client         |
                      |  - Route Guards (UX)                  |
                      |  - Permission Guards (UX)             |
                      |  - Input Validation & Sanitization    |
                      |  - Supabase Publishable Key Only      |
                      +-------------------+-------------------+
                                          |
                                    HTTPS / JWT
                                          |
                                          v
                      +---------------------------------------+
                      |             Supabase API              |
                      |  - JWT Signature & Expiry Check       |
                      |  - Rate Limiting                      |
                      |  - auth.uid() Extraction              |
                      +-------------------+-------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |       PostgreSQL Database Engine      |
                      |                                       |
                      |   +-------------------------------+   |
                      |   |     Row Level Security (RLS)  |   |
                      |   |   - Table-specific Policies   |   |
                      |   |   - Project Membership Checks |   |
                      |   |   - auth_has_permission()     |   |
                      |   +---------------+---------------+   |
                      |                   |                   |
                      |   +---------------v---------------+   |
                      |   |      Security Definer Utils   |   |
                      |   |   - search_path = public,     |   |
                      |   |     pg_temp                   |   |
                      |   |   - Revoke public EXECUTE     |   |
                      |   +---------------+---------------+   |
                      |                   |                   |
                      |   +---------------v---------------+   |
                      |   |      Immutable Audit Engine   |   |
                      |   |   - audit_logs (append-only)  |   |
                      |   |   - automatic triggers        |   |
                      |   +-------------------------------+   |
                      +---------------------------------------+
```

---

## 4. Supabase API Key & Environment Architecture

### 4.1 Key Separation Model
* **Browser Code (`/src`)**:
  * `VITE_SUPABASE_URL`: Public Supabase Project Endpoint.
  * `VITE_SUPABASE_PUBLISHABLE_KEY`: Public / Anonymous Key (safe for browser distribution).
  * Backward compatibility supported: `VITE_SUPABASE_ANON_KEY`.
* **Private / Serverless / Edge Functions (`/supabase/functions`)**:
  * `SUPABASE_URL`: Private environment variable.
  * `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: Privileged backend key. **NEVER** expose to Vite or bundle into client.

---

## 5. Role & Granular Permission Matrix

The application supports 7 standard roles:
1. `Management / CEO`
2. `Admin / Client & Workforce Coordinator`
3. `Technical Inspection & QC Officer`
4. `Site Supervisor`
5. `Procurement & Logistics`
6. `Accounts`
7. `Artisan / Workforce`

### 5.1 Permission Format
Permissions follow the granular `module.action` convention:
* **Projects**: `projects.view`, `projects.create`, `projects.update`, `projects.approve`, `projects.delete`
* **Finance**: `finance.view`, `finance.create`, `finance.update`, `finance.approve`, `finance.pay`
* **Materials & Procurement**: `materials.view`, `materials.request`, `materials.approve`, `materials.receive`, `materials.issue`
* **Inspection & Quality**: `inspection.view`, `inspection.create`, `inspection.update`, `inspection.certify`
* **Workforce & Artisans**: `workforce.view`, `workforce.manage`, `attendance.record`, `attendance.view`
* **System Administration**: `users.manage`, `roles.manage`, `audit.view`

### 5.2 Role to Permission Mapping
* **Management / CEO**: Has wildcard/comprehensive access across all modules and full financial approval capability.
* **Accounts**: `finance.*`, `materials.view`, `projects.view` (cannot certify technical inspections or alter site supervision).
* **Technical / QC**: `inspection.*`, `projects.view` (cannot approve financial disbursements or purchase orders).
* **Site Supervisor**: `projects.view` (assigned only), `materials.request`, `materials.receive`, `inspection.create`, `attendance.record`.
* **Procurement**: `materials.*`, `suppliers.*`, `finance.view` (procurement orders only).
* **Artisan**: `attendance.view` (own only), `workforce.view` (own tasks only).

---

## 6. PostgreSQL Row Level Security (RLS) Blueprint

### 6.1 Core Security Function: `auth_has_permission()`
```sql
CREATE OR REPLACE FUNCTION public.auth_has_permission(requested_permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_user_id uuid;
  v_is_management boolean;
  v_has_perm boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Management bypass for operational modules
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_user_id AND r.slug = 'management'
  ) INTO v_is_management;

  IF v_is_management THEN
    RETURN true;
  END IF;

  -- 2. Check granular permissions
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = v_user_id AND p.name = requested_permission
  ) INTO v_has_perm;

  RETURN COALESCE(v_has_perm, false);
END;
$$;

REVOKE ALL ON FUNCTION public.auth_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_has_permission(text) TO authenticated;
```

---

## 7. Storage Security Strategy

1. **Private Buckets**:
   * `project-documents`: Private bucket for contracts, architectural drawings, and invoices.
   * `qc-inspections`: Private bucket for inspection reports and compliance photography.
   * `finance-receipts`: Private bucket for payment receipts and vouchers.
2. **Access Rules**:
   * Storage RLS enforces that users can only upload or download files if they possess the respective permission (e.g. `inspection.certify`, `finance.view`).
   * Permanent public URLs are disabled for all sensitive buckets. Access is granted exclusively through short-lived (e.g., 15-minute) signed URLs generated on-demand.

---

## 8. Incident Response & Security Testing Checklist

| Test # | Test Case Description | Expected Result | Security Boundary |
| :--- | :--- | :--- | :--- |
| **ST-01** | Unauthenticated request to `profiles` table via Supabase REST | HTTP 401 / Empty dataset | Database RLS |
| **ST-02** | User attempts to update another user's `role` via REST payload | Rejected by database RLS (0 rows updated) | Database RLS |
| **ST-03** | User modifies `davejoe_active_role_key` in `localStorage` to `management` | UI route guard redirects to authorized dashboard; API queries reject unauthorized access | Frontend Guard & RLS |
| **ST-04** | Site Supervisor attempts to query `financial_records` / invoices | Rejected with empty set / 403 Forbidden | Database RLS |
| **ST-05** | Regular user executes `DELETE FROM audit_logs` | Rejected: Policy denies DELETE for all roles | Database RLS |
| **ST-06** | Inactive or suspended user attempts sign-in | Rejected during auth verification; token revoked | Auth Service & DB Check |
| **ST-07** | Attacker calls `auth_has_permission` directly with spoofed UUID | Function only executes against verified `auth.uid()` | Security Definer |
