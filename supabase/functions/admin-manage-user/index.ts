
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

  if (!isManagement && !isExecutiveDirector) {
    return response(
      { error: "You are not authorized to manage users." },
      403,
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return response({ error: "Invalid JSON request." }, 400);
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
