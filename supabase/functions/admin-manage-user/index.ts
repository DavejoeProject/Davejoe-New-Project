
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = (
  Deno.env.get("ALLOWED_ORIGINS") ??
  "https://davejoe-new-project.vercel.app"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const baseCorsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { ...baseCorsHeaders };

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  const response = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return response({ error: "Server configuration is incomplete." }, 500);
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return response({ error: "Authentication required." }, 401);
  }

  const token = authorization.slice("Bearer ".length);

  // Validate the caller's JWT using Supabase Auth.
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: authData, error: authError } =
    await authClient.auth.getUser(token);

  if (authError || !authData.user) {
    return response({ error: "Invalid or expired session." }, 401);
  }

  const requester = authData.user;

  // This privileged client must remain server-side only.
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Verify the caller is active.
  const { data: requesterProfile, error: profileError } =
    await adminClient
      .from("profiles")
      .select("id, status")
      .eq("id", requester.id)
      .maybeSingle();

  if (
    profileError ||
    !requesterProfile ||
    requesterProfile.status !== "active"
  ) {
    return response({ error: "Active staff account required." }, 403);
  }

  // Verify the caller's current role assignments.
  const { data: requesterRoles, error: rolesError } =
    await adminClient
      .from("user_roles")
      .select("roles(slug)")
      .eq("user_id", requester.id);

  if (rolesError) {
    return response({ error: "Could not verify your role." }, 500);
  }

  const slugs = (requesterRoles ?? []).map((row: any) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.slug;
  });

  const isManagement = slugs.includes("management");
  const isExecutiveDirector = slugs.includes("executive_director");


  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return response({ error: "Invalid JSON request." }, 400);
  }

const action =
  typeof body.action === "string" ? body.action.trim() : "invite_user";

const allowedActions = [
  "create_user",
  "invite_user",
  "update_profile",
  "update_status",
  "assign_role",
  "remove_role",
  "assign_role_permission",
  "remove_role_permission",
];

if (!allowedActions.includes(action)) {
  return response({ error: "Unsupported administration action." }, 400);
}

const isSelfNameUpdate =
  action === "update_profile" &&
  typeof body.user_id === "string" &&
  body.user_id.trim() === requester.id &&
  typeof body.job_title !== "string";

if (!isManagement && !isExecutiveDirector && !isSelfNameUpdate) {
  return response(
    { error: "You are not authorized to perform this administrative action." },
    403,
  );
}

if (action === "update_profile") {
  const userId =
    typeof body.user_id === "string" ? body.user_id.trim() : "";

  const firstName =
    typeof body.first_name === "string" ? body.first_name.trim() : undefined;

  const lastName =
    typeof body.last_name === "string" ? body.last_name.trim() : undefined;

  const jobTitle =
    typeof body.job_title === "string" ? body.job_title.trim() : undefined;

  if (!userId) {
    return response({ error: "Target user ID is required." }, 400);
  }

  if (
    firstName === undefined &&
    lastName === undefined &&
    jobTitle === undefined
  ) {
    return response(
      { error: "No supported profile changes were supplied." },
      400,
    );
  }

  if (
    (firstName !== undefined && !firstName) ||
    (lastName !== undefined && !lastName)
  ) {
    return response(
      { error: "First and last names cannot be blank." },
      400,
    );
  }

  const { data: targetProfile, error: targetError } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name, display_name, job_title")
    .eq("id", userId)
    .maybeSingle();

  if (targetError) {
    return response({ error: "Could not load the target profile." }, 500);
  }

  if (!targetProfile) {
    return response({ error: "Target staff profile not found." }, 404);
  }

// All users may update their own names, but not their own job title.
if (userId === requester.id && jobTitle !== undefined) {
  return response(
    { error: "You may update your own name, but not your job title." },
    403,
  );
}

// Both Management / CEO and Executive Director have equal administrative authority to update staff profiles.
// Ordinary staff are blocked by the top-level authorization check.

  const updates: Record<string, string> = {};

  if (firstName !== undefined) updates.first_name = firstName;
  if (lastName !== undefined) updates.last_name = lastName;

  const nextFirstName = firstName ?? targetProfile.first_name ?? "";
  const nextLastName = lastName ?? targetProfile.last_name ?? "";

  if (firstName !== undefined || lastName !== undefined) {
    updates.display_name = [nextFirstName, nextLastName]
      .filter(Boolean)
      .join(" ");
  }

  if (jobTitle !== undefined) updates.job_title = jobTitle;

  const oldValues = {
    first_name: targetProfile.first_name,
    last_name: targetProfile.last_name,
    display_name: targetProfile.display_name,
    job_title: targetProfile.job_title,
  };

  const newValues = {
    ...oldValues,
    ...updates,
  };

  const { error: updateError } = await adminClient
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (updateError) {
    return response({ error: "Could not update the staff profile." }, 500);
  }

  return response({
    success: true,
    message: "Staff profile updated.",
    oldValues,
    newValues,
  });
}

if (action === "update_status") {
  const userId =
    typeof body.user_id === "string" ? body.user_id.trim() : "";

  const newStatus =
    typeof body.status === "string" ? body.status.trim() : "";

  const allowedStatuses = ["active", "inactive", "suspended", "pending"];

  if (!userId || !allowedStatuses.includes(newStatus)) {
    return response({ error: "A valid user ID and account status are required." }, 400);
  }

  // Prevent an administrator from accidentally disabling their own account.
  if (userId === requester.id && newStatus !== "active") {
    return response({ error: "You cannot deactivate or suspend your own account through this action." }, 403);
  }

  const { data: targetProfile, error: targetError } = await adminClient
    .from("profiles")
    .select("id, status")
    .eq("id", userId)
    .maybeSingle();

  if (targetError) {
    return response({ error: "Could not load the target account." }, 500);
  }

  if (!targetProfile) {
    return response({ error: "Target staff account not found." }, 404);
  }

  // Both Management / CEO and Executive Director have equal administrative authority to update staff statuses.
  // Self-suspension is strictly prohibited above; ordinary staff are blocked by top-level check.

  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (updateError) {
    return response({ error: "Could not update the account status in database profiles." }, 500);
  }

  // Synchronize Supabase Auth Account restrictions via Auth Admin API
  try {
    if (newStatus === "active") {
      // Lift any temporary or permanent bans so the user can authenticate
      await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: "none",
        app_metadata: { status: "active" },
      });
    } else if (newStatus === "suspended") {
      // Apply temporary suspension ban (invalidates refresh tokens and blocks sign-in)
      await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: "876600h",
        app_metadata: { status: "suspended" },
      });
    } else if (newStatus === "inactive") {
      // Deactivate account access via Auth ban and metadata
      await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: "876600h",
        app_metadata: { status: "inactive" },
      });
    } else if (newStatus === "pending") {
      await adminClient.auth.admin.updateUserById(userId, {
        app_metadata: { status: "pending" },
      });
    }
  } catch (authAdminErr) {
    console.warn("[admin-manage-user] Auth admin ban update notice:", authAdminErr);
  }

  // Write audit log entry
  try {
    await adminClient.from("audit_logs").insert({
      actor_id: requester.id,
      action: "admin.user_status_changed",
      module: "administration",
      table_name: "profiles",
      record_id: userId,
      old_values: { status: targetProfile.status },
      new_values: { status: newStatus },
      created_at: new Date().toISOString(),
    });
  } catch (auditErr) {
    console.warn("[admin-manage-user] Audit log write notice:", auditErr);
  }

  return response({
    success: true,
    message: `Account status updated to ${newStatus}.`,
    oldValues: {
      status: targetProfile.status,
    },
    newValues: {
      status: newStatus,
    },
  });
}



if (action === "assign_role" || action === "remove_role") {
  const userId =
    typeof body.user_id === "string" ? body.user_id.trim() : "";

  const roleSlug =
    typeof body.role_slug === "string" ? body.role_slug.trim() : "";

  if (!userId || !roleSlug) {
    return response({ error: "Target user ID and role slug are required." }, 400);
  }

if (userId === requester.id) {
  return response(
    { error: "You cannot change your own role assignments." },
    403,
  );
}

  // Both Management / CEO and Executive Director have equal authority to assign or remove staff and leadership roles.
  // Self-assignment/removal is prohibited above; ordinary staff are blocked by top-level check.
  const { data: targetRole, error: targetRoleError } = await adminClient
    .from("roles")
    .select("id, slug")
    .eq("slug", roleSlug)
    .maybeSingle();

  if (targetRoleError) {
    return response({ error: "Could not verify the selected role." }, 500);
  }

  if (!targetRole) {
    return response({ error: "Selected role does not exist." }, 404);
  }

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from("profiles")
    .select("id, status")
    .eq("id", userId)
    .maybeSingle();

  if (targetProfileError) {
    return response({ error: "Could not verify the target account." }, 500);
  }

  if (!targetProfile) {
    return response({ error: "Target account not found." }, 404);
  }

  if (action === "assign_role") {
    const { data: existing, error: existingError } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_id", targetRole.id)
      .maybeSingle();

    if (existingError) {
      return response({ error: "Could not check the existing role assignment." }, 500);
    }

    if (existing) {
      return response({ success: true, message: "Role is already assigned." });
    }

    const { error: insertError } = await adminClient.from("user_roles").insert({
      user_id: userId,
      role_id: targetRole.id,
      assigned_by: requester.id,
    });

    if (insertError) {
      return response({ error: "Could not assign the selected role." }, 500);
    }

    return response({ success: true, message: "Role assigned." });
  }

  const { data: existingAssignment, error: assignmentError } = await adminClient
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role_id", targetRole.id)
    .maybeSingle();

  if (assignmentError) {
    return response({ error: "Could not verify the role assignment." }, 500);
  }

  if (!existingAssignment) {
    return response({ success: true, message: "Role is not assigned." });
  }

  if (roleSlug === "admin") {
    const { data: adminRole, error: adminRoleError } = await adminClient
      .from("roles")
      .select("id")
      .eq("slug", "admin")
      .maybeSingle();

    if (adminRoleError || !adminRole) {
      return response({ error: "Could not verify the Admin role." }, 500);
    }

    const { data: adminAssignments, error: adminAssignmentsError } =
      await adminClient
        .from("user_roles")
        .select("user_id, profiles!inner(status)")
        .eq("role_id", adminRole.id)
        .eq("profiles.status", "active");

    if (adminAssignmentsError) {
      return response({ error: "Could not verify active Admin accounts." }, 500);
    }

    const activeAdminIds = new Set(
      (adminAssignments ?? []).map((row: any) => row.user_id),
    );

    if (
      activeAdminIds.has(userId) &&
      activeAdminIds.size <= 1
    ) {
      return response({
        error: "Cannot remove the last active Admin account.",
      }, 403);
    }
  }

  const { error: deleteError } = await adminClient
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role_id", targetRole.id);

  if (deleteError) {
    return response({ error: "Could not remove the selected role." }, 500);
  }

  return response({ success: true, message: "Role removed." });
}


if (
  action === "assign_role_permission" ||
  action === "remove_role_permission"
) {
  // Role-permission management is restricted to Management/CEO.
  // Executive Director is explicitly excluded.
  if (!isManagement && !isExecutiveDirector) {
  return response(
    { error: "You are not authorized to manage role permissions." },
    403,
  );
}

  const roleId =
    typeof body.role_id === "string" ? body.role_id.trim() : "";

  const permissionId =
    typeof body.permission_id === "string"
      ? body.permission_id.trim()
      : "";

  if (!roleId || !permissionId) {
    return response(
      { error: "Role ID and permission ID are required." },
      400,
    );
  }

  const { data: targetRole, error: roleError } = await adminClient
    .from("roles")
    .select("id, slug, name")
    .eq("id", roleId)
    .maybeSingle();

  if (roleError) {
    return response({ error: "Could not verify the selected role." }, 500);
  }

  if (!targetRole) {
    return response({ error: "Selected role not found." }, 404);
  }

  const { data: targetPermission, error: permissionError } =
    await adminClient
      .from("permissions")
      .select("id, name")
      .eq("id", permissionId)
      .maybeSingle();

  if (permissionError) {
    return response(
      { error: "Could not verify the selected permission." },
      500,
    );
  }

  if (!targetPermission) {
    return response({ error: "Selected permission not found." }, 404);
  }

  // Protect essential permissions on the Admin role.
  const essentialAdminPermissions = [
    "roles.manage",
    "users.manage",
    "users.view",
    "audit.view",
  ];

  if (
    action === "remove_role_permission" &&
    targetRole.slug === "admin" &&
    essentialAdminPermissions.includes(targetPermission.name)
  ) {
    return response(
      {
        error:
          `Cannot remove essential administrative permission "${targetPermission.name}" from the Admin role.`,
      },
      403,
    );
  }

  const { data: existingAssignment, error: assignmentError } =
    await adminClient
      .from("role_permissions")
      .select("role_id, permission_id")
      .eq("role_id", roleId)
      .eq("permission_id", permissionId)
      .maybeSingle();

  if (assignmentError) {
    return response(
      { error: "Could not verify the existing permission assignment." },
      500,
    );
  }

  if (action === "assign_role_permission") {
    if (existingAssignment) {
      return response({
        success: true,
        message: "Permission is already assigned to this role.",
      });
    }

    const { error: insertError } = await adminClient
      .from("role_permissions")
      .insert({
        role_id: roleId,
        permission_id: permissionId,
      });

    if (insertError) {
      return response(
        { error: "Could not assign the permission to this role." },
        500,
      );
    }

    return response({
      success: true,
      message: "Permission assigned to role.",
      oldValues: null,
      newValues: {
        role_id: roleId,
        role_slug: targetRole.slug,
        permission_id: permissionId,
        permission_name: targetPermission.name,
      },
    });
  }

  if (!existingAssignment) {
    return response({
      success: true,
      message: "Permission is not assigned to this role.",
    });
  }

  const { error: deleteError } = await adminClient
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId)
    .eq("permission_id", permissionId);

  if (deleteError) {
    return response(
      { error: "Could not remove the permission from this role." },
      500,
    );
  }

  return response({
    success: true,
    message: "Permission removed from role.",
    oldValues: {
      role_id: roleId,
      role_slug: targetRole.slug,
      permission_id: permissionId,
      permission_name: targetPermission.name,
    },
    newValues: null,
  });
}


if (action !== "create_user" && action !== "invite_user") {
  return response(
    { error: `Action "${action}" is recognized but is not implemented yet.` },
    400,
  );
}

  const email =
    typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
  const firstName =
    typeof body.first_name === "string"
      ? body.first_name.trim()
      : typeof body.firstName === "string"
        ? body.firstName.trim()
        : "";
  const lastName =
    typeof body.last_name === "string"
      ? body.last_name.trim()
      : typeof body.lastName === "string"
        ? body.lastName.trim()
        : "";
  const phone =
    typeof body.phone === "string" ? body.phone.trim() : "";
  const jobTitle =
    typeof body.job_title === "string"
      ? body.job_title.trim()
      : typeof body.jobTitle === "string"
        ? body.jobTitle.trim()
        : "";
  const employeeCode =
    typeof body.employee_code === "string"
      ? body.employee_code.trim()
      : typeof body.employeeCode === "string"
        ? body.employeeCode.trim()
        : "";

  // Extract requested role slugs (supports array role_slugs / roleSlugs or single role_slug / roleSlug)
  const rawRoleSlugs: string[] = Array.isArray(body.role_slugs)
    ? (body.role_slugs as string[])
    : Array.isArray(body.roleSlugs)
      ? (body.roleSlugs as string[])
      : typeof body.role_slug === "string" && body.role_slug.trim()
        ? [body.role_slug.trim()]
        : typeof body.roleSlug === "string" && body.roleSlug.trim()
          ? [body.roleSlug.trim()]
          : [];

  const requestedRoleSlugs = rawRoleSlugs
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response({ error: "A valid corporate or personnel email address is required." }, 400);
  }

  if (!firstName) {
    return response({ error: "First name is required." }, 400);
  }

  if (requestedRoleSlugs.length === 0) {
    return response({ error: "At least one role assignment is required." }, 400);
  }

  // Check for duplicate account in profiles
  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    return response({ error: "Could not verify existing account status." }, 500);
  }

  if (existingProfile) {
    return response({ error: `An account with email "${email}" already exists.` }, 400);
  }

  // Resolve requested roles from the database
  const { data: matchedRoles, error: rolesQueryError } = await adminClient
    .from("roles")
    .select("id, slug, name")
    .in("slug", requestedRoleSlugs);

  if (rolesQueryError) {
    return response({ error: "Could not verify the requested roles." }, 500);
  }

  if (!matchedRoles || matchedRoles.length === 0) {
    return response({ error: "None of the specified roles exist in the system." }, 400);
  }

  // Both Management / CEO and Executive Director have equal authority to assign any roles
  // Ordinary staff are blocked by top-level check.

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || email.split("@")[0];
  let newUserId: string;

  if (action === "create_user") {
    const rawPassword =
      typeof body.password === "string" && body.password.trim().length >= 6
        ? body.password.trim()
        : `Davejoe${Math.floor(100000 + Math.random() * 900000)}!`;

    const { data: createData, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password: rawPassword,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName || null,
          display_name: displayName,
          phone: phone || null,
        },
      });

    if (createError || !createData?.user) {
      return response({
        error: createError?.message ?? "Could not create user account in authentication service.",
      }, 400);
    }
    newUserId = createData.user.id;
  } else {
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name: firstName,
          last_name: lastName || null,
          display_name: displayName,
          phone: phone || null,
        },
      });

    if (inviteError || !inviteData?.user) {
      return response({
        error: inviteError?.message ?? "Could not send invitation email to this address.",
      }, 400);
    }
    newUserId = inviteData.user.id;
  }

  // Upsert the profile
  const { error: insertProfileError } = await adminClient
    .from("profiles")
    .upsert({
      id: newUserId,
      email,
      first_name: firstName,
      last_name: lastName || null,
      display_name: displayName,
      phone: phone || null,
      job_title: jobTitle || null,
      employee_code: employeeCode || null,
      status: action === "create_user" ? "active" : "pending",
    }, { onConflict: "id" });

  if (insertProfileError) {
    await adminClient.auth.admin.deleteUser(newUserId);
    return response({
      error: "User was created in auth, but profile initialization failed. The user has been rolled back.",
    }, 500);
  }

  // Insert assigned roles into user_roles
  const roleInserts = matchedRoles.map((role) => ({
    user_id: newUserId,
    role_id: role.id,
    assigned_by: requester.id,
  }));

  const { error: assignmentError } = await adminClient
    .from("user_roles")
    .insert(roleInserts);

  if (assignmentError) {
    // Best-effort cleanup rollback
    await adminClient.from("user_roles").delete().eq("user_id", newUserId);
    await adminClient.from("profiles").delete().eq("id", newUserId);
    await adminClient.auth.admin.deleteUser(newUserId);

    return response({
      error: "Role assignment failed. The new account was cleanly rolled back.",
    }, 500);
  }

  const assignedRoleSlugs = matchedRoles.map((r) => r.slug);

  // Write to audit log
  try {
    await adminClient.from("audit_logs").insert({
      actor_id: requester.id,
      action: action === "create_user" ? "admin.user_created" : "admin.user_invited",
      module: "administration",
      table_name: "profiles",
      record_id: newUserId,
      new_values: {
        user_id: newUserId,
        email,
        display_name: displayName,
        roles: assignedRoleSlugs,
        created_by: requester.id,
        action,
      },
    });
  } catch (auditErr) {
    console.error("[admin-manage-user] Audit log error (non-fatal):", auditErr);
  }

  return response({
    success: true,
    user_id: newUserId,
    email,
    assigned_roles: assignedRoleSlugs,
    message: action === "create_user"
      ? "User account created and roles assigned successfully."
      : "Invitation sent and roles assigned successfully.",
    user: {
      id: newUserId,
      email,
      display_name: displayName,
      roles: assignedRoleSlugs,
    },
  }, 201);
});
