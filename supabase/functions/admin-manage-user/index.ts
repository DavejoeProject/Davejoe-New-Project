
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

  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const originAllowed = origin !== null && allowedOrigins.includes(origin);
  const corsHeaders = getCorsHeaders(origin);

  const response = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  // Reject unapproved browser origins before processing the request.
  if (origin !== null && !originAllowed) {
    return response({ error: "Origin not allowed." }, 403);
  }

  if (req.method === "OPTIONS") {
    if (!originAllowed) {
      return response({ error: "Origin not allowed." }, 403);
    }

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

// Executive Director cannot edit another leadership account's profile.
if (
  isExecutiveDirector &&
  !isManagement &&
  userId !== requester.id
) {
  const { data: targetRoles, error: targetRolesError } = await adminClient
    .from("user_roles")
    .select("roles(slug)")
    .eq("user_id", userId);

  if (targetRolesError) {
    return response(
      { error: "Could not verify the target account's roles." },
      500,
    );
  }

  const targetSlugs = (targetRoles ?? []).map((row: any) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.slug;
  });

  if (
    targetSlugs.includes("management") ||
    targetSlugs.includes("executive_director")
  ) {
    return response(
      { error: "Executive Director cannot edit leadership profiles." },
      403,
    );
  }
}

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

  // Executive Director cannot change the status of Management or another ED.
  if (isExecutiveDirector && !isManagement) {
    const { data: targetRoles, error: targetRolesError } = await adminClient
      .from("user_roles")
      .select("roles(slug)")
      .eq("user_id", userId);

    if (targetRolesError) {
      return response({ error: "Could not verify the target account's roles." }, 500);
    }

    const targetSlugs = (targetRoles ?? []).map((row: any) => {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      return role?.slug;
    });

    if (targetSlugs.includes("management") || targetSlugs.includes("executive_director")) {
      return response({ error: "Executive Director cannot change the status of leadership accounts." }, 403);
    }
  }

  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ status: newStatus })
    .eq("id", userId);

  if (updateError) {
    return response({ error: "Could not update the account status." }, 500);
  }

 return response({
  success: true,
  message: "Account status updated.",
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

  const leadershipRoles = ["management", "executive_director"];

  if (!isManagement && leadershipRoles.includes(roleSlug)) {
    return response({
      error: "Only Management/CEO can assign or remove leadership roles.",
    }, 403);
  }

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

  // The Executive Director cannot administer leadership accounts.
  if (!isManagement && userId !== requester.id) {
    const { data: targetRoles, error: targetRolesError } = await adminClient
      .from("user_roles")
      .select("roles(slug)")
      .eq("user_id", userId);

    if (targetRolesError) {
      return response({ error: "Could not verify the target account's roles." }, 500);
    }

    const targetSlugs = (targetRoles ?? []).map((row: any) => {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      return role?.slug;
    });

    if (targetSlugs.some((slug: string) => leadershipRoles.includes(slug))) {
      return response({
        error: "Executive Director cannot modify leadership account assignments.",
      }, 403);
    }
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


if (action !== "invite_user") {
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
    typeof body.first_name === "string" ? body.first_name.trim() : "";
  const lastName =
    typeof body.last_name === "string" ? body.last_name.trim() : "";
  const phone =
    typeof body.phone === "string" ? body.phone.trim() : "";
  const jobTitle =
    typeof body.job_title === "string" ? body.job_title.trim() : "";
  const employeeCode =
    typeof body.employee_code === "string"
      ? body.employee_code.trim()
      : "";
  const roleSlug =
    typeof body.role_slug === "string" ? body.role_slug.trim() : "";

  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !firstName ||
    !roleSlug
  ) {
    return response({
      error: "Valid email, first name, and role are required.",
    }, 400);
  }

  // Executive Director cannot grant leadership-level roles.
  if (
    !isManagement &&
    ["management", "executive_director"].includes(roleSlug)
  ) {
    return response({
      error: "Only Management/CEO can assign leadership-level roles.",
    }, 403);
  }

  // Resolve an existing role; never create roles from request input.
  const { data: targetRole, error: targetRoleError } =
    await adminClient
      .from("roles")
      .select("id, slug, name")
      .eq("slug", roleSlug)
      .maybeSingle();

  if (targetRoleError) {
    return response({ error: "Could not verify the selected role." }, 500);
  }

  if (!targetRole) {
    return response({ error: "Selected role does not exist." }, 400);
  }

  // Invite the user instead of accepting a password from the caller.
  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name: firstName,
        last_name: lastName,
        display_name: [firstName, lastName].filter(Boolean).join(" "),
      },
    });

  if (inviteError || !inviteData.user) {
    return response({
      error: inviteError?.message ?? "Could not invite this user.",
    }, 400);
  }

  const newUserId = inviteData.user.id;

  // Create the staff profile in a pending state.
  const { error: insertProfileError } = await adminClient
    .from("profiles")
    .upsert({
      id: newUserId,
      first_name: firstName,
      last_name: lastName || null,
      display_name: [firstName, lastName].filter(Boolean).join(" "),
      phone: phone || null,
      job_title: jobTitle || null,
      employee_code: employeeCode || null,
      status: "pending",
    }, { onConflict: "id" });

  if (insertProfileError) {
    await adminClient.auth.admin.deleteUser(newUserId);

    return response({
      error: "Invitation created, but profile setup failed. Please retry after checking the account state.",
    }, 500);
  }

  const { error: assignmentError } = await adminClient
    .from("user_roles")
    .insert({
      user_id: newUserId,
      role_id: targetRole.id,
      assigned_by: requester.id,
    });

  if (assignmentError) {
    // Best-effort cleanup if role assignment fails.
    await adminClient.from("user_roles").delete().eq("user_id", newUserId);
    await adminClient.from("profiles").delete().eq("id", newUserId);
    await adminClient.auth.admin.deleteUser(newUserId);

    return response({
      error: "Role assignment failed. The new account was rolled back where possible.",
    }, 500);
  }

  return response({
    success: true,
    message: "Invitation sent and role assigned.",
    user: {
      id: newUserId,
      email,
      display_name: [firstName, lastName].filter(Boolean).join(" "),
      role: targetRole.slug,
    },
  }, 201);
});
