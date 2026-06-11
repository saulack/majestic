import { buildMaintenanceSummaries } from "@/lib/maintenance";
import type {
  FeatureRequest,
  FeatureRequestType,
  InAppNotification,
  MaintenanceThresholdApproval,
  MaintenanceNotification,
  MaintenanceRecord,
  MaintenanceSummary,
  MaintenanceType,
  NotificationPreference,
  Reservation,
  ReservationStatus,
  UserProfile
} from "@/lib/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function buildFallbackAuthenticatedUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): UserProfile {
  const fullName =
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ||
    (user.email?.split("@")[0] ?? "User");

  return {
    id: user.id,
    fullName,
    email: user.email?.toLowerCase() ?? "",
    role: "user",
    forcePasswordReset: false
  };
}

export async function getAuthenticatedUserProfile(): Promise<UserProfile | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,force_password_reset")
    .eq("id", user.id)
    .maybeSingle();

  const admin = createAdminClient();
  const normalizedEmail = user.email?.toLowerCase() ?? "";
  const { data: roleGrant } = admin
    ? await admin.from("role_grants").select("role").ilike("email", normalizedEmail).maybeSingle()
    : { data: null };

  const grantedRole = roleGrant?.role === "admin" || roleGrant?.role === "superadmin" ? roleGrant.role : null;

  if (profileError && !profile) {
    if (!admin) {
      const fallback = buildFallbackAuthenticatedUser(user);
      return grantedRole ? { ...fallback, role: grantedRole } : fallback;
    }
  }

  if (!profile) {
    if (!admin) {
      const fallback = buildFallbackAuthenticatedUser(user);
      return grantedRole ? { ...fallback, role: grantedRole } : fallback;
    }

    let resolvedRole: "user" | "admin" | "superadmin" = "user";
    if (grantedRole) {
      resolvedRole = grantedRole;
    }

    const fallbackName =
      (user.user_metadata?.full_name as string | undefined)?.trim() ||
      (user.email?.split("@")[0] ?? "User");

    const { data: upsertedProfile, error: upsertError } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email?.toLowerCase() ?? "",
          full_name: fallbackName,
          role: resolvedRole,
          force_password_reset: false
        },
        { onConflict: "id" }
      )
      .select("id,full_name,email,role,force_password_reset")
      .single();

    if (upsertError || !upsertedProfile) {
      return buildFallbackAuthenticatedUser(user);
    }

    return {
      id: upsertedProfile.id,
      fullName: upsertedProfile.full_name,
      email: upsertedProfile.email,
      role: upsertedProfile.role,
      forcePasswordReset: upsertedProfile.force_password_reset
    };
  }

  if (grantedRole && profile.role !== grantedRole && admin) {
    await admin.from("profiles").update({ role: grantedRole }).eq("id", profile.id);
    profile.role = grantedRole;
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    forcePasswordReset: profile.force_password_reset
  };
}

export async function getNotificationPreference(userId: string): Promise<NotificationPreference | undefined> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return undefined;
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("email_enabled,sms_enabled,reservation_confirmation_email,reservation_booked_by_other_email,in_app_inbox_digest_email,in_app_inbox_digest_last_sent_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return undefined;
  }

  if (!data) {
    return {
      userId,
      channels: [],
      reservationConfirmationEmail: false,
      reservationBookedByOtherEmail: false,
      inAppInboxDigestEmail: false
    };
  }

  const channels: Array<"email" | "sms"> = [];

  if (data.email_enabled) {
    channels.push("email");
  }

  if (data.sms_enabled) {
    channels.push("sms");
  }

  return {
    userId,
    channels,
    reservationConfirmationEmail: Boolean(data.reservation_confirmation_email),
    reservationBookedByOtherEmail: Boolean(data.reservation_booked_by_other_email),
    inAppInboxDigestEmail: Boolean(data.in_app_inbox_digest_email),
    inAppInboxDigestLastSentAt: (data.in_app_inbox_digest_last_sent_at as string | null) ?? undefined
  };
}

export async function getAllReservations(): Promise<Reservation[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("reservations")
    .select(`
      id,
      user_id,
      start_date,
      end_date,
      shared_with_user_ids,
      shared_range_start_date,
      shared_range_end_date,
      notes,
      status,
      decline_reason,
      created_by,
      reviewed_by,
      reviewed_at,
      created_at,
      owner:profiles!reservations_user_id_fkey(full_name),
      creator:profiles!reservations_created_by_fkey(full_name),
      reviewer:profiles!reservations_reviewed_by_fkey(full_name)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    userName: ((row.owner as unknown as { full_name: string } | null)?.full_name) ?? "Unknown",
    sharedWithUserIds: (row.shared_with_user_ids as string[] | null) ?? [],
    sharedRangeStartDate: (row.shared_range_start_date as string | null) ?? undefined,
    sharedRangeEndDate: (row.shared_range_end_date as string | null) ?? undefined,
    createdByUserId: (row.created_by as string | null) ?? undefined,
    createdByName: ((row.creator as unknown as { full_name: string } | null)?.full_name) ?? undefined,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    notes: (row.notes as string | null) ?? undefined,
    status: row.status as ReservationStatus,
    declineReason: (row.decline_reason as string | null) ?? undefined,
    reviewedByUserId: (row.reviewed_by as string | null) ?? undefined,
    reviewedByName: ((row.reviewer as unknown as { full_name: string } | null)?.full_name) ?? undefined,
    reviewedAt: (row.reviewed_at as string | null) ?? undefined,
    createdAt: row.created_at as string
  }));
}

export async function getReservationsForUser(userId: string): Promise<Reservation[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("reservations")
    .select(`
      id,
      user_id,
      start_date,
      end_date,
      shared_with_user_ids,
      shared_range_start_date,
      shared_range_end_date,
      notes,
      status,
      decline_reason,
      created_by,
      reviewed_by,
      reviewed_at,
      created_at,
      owner:profiles!reservations_user_id_fkey(full_name),
      creator:profiles!reservations_created_by_fkey(full_name),
      reviewer:profiles!reservations_reviewed_by_fkey(full_name)
    `)
    .eq("user_id", userId)
    .order("start_date", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    userName: ((row.owner as unknown as { full_name: string } | null)?.full_name) ?? "Unknown",
    sharedWithUserIds: (row.shared_with_user_ids as string[] | null) ?? [],
    sharedRangeStartDate: (row.shared_range_start_date as string | null) ?? undefined,
    sharedRangeEndDate: (row.shared_range_end_date as string | null) ?? undefined,
    createdByUserId: (row.created_by as string | null) ?? undefined,
    createdByName: ((row.creator as unknown as { full_name: string } | null)?.full_name) ?? undefined,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    notes: (row.notes as string | null) ?? undefined,
    status: row.status as ReservationStatus,
    declineReason: (row.decline_reason as string | null) ?? undefined,
    reviewedByUserId: (row.reviewed_by as string | null) ?? undefined,
    reviewedByName: ((row.reviewer as unknown as { full_name: string } | null)?.full_name) ?? undefined,
    reviewedAt: (row.reviewed_at as string | null) ?? undefined,
    createdAt: row.created_at as string
  }));
}

export async function getAllProfiles(): Promise<UserProfile[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,force_password_reset")
    .order("full_name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    fullName: entry.full_name,
    email: entry.email,
    role: entry.role,
    forcePasswordReset: entry.force_password_reset
  }));
}

export async function getMaintenanceTypes(): Promise<MaintenanceType[]> {
  const admin = createAdminClient();
  if (!admin) {
    return [];
  }

  const { data: currentTypes, error: currentTypesError } = await admin
    .from("maintenance_types")
    .select("id,name,threshold_days,created_by,created_at")
    .order("name", { ascending: true });

  if (currentTypesError || !currentTypes) {
    return [];
  }

  const { data: maintenanceContacts, error: contactsError } = await admin
    .from("info_contacts")
    .select("role_function,maintenance_category")
    .eq("is_maintenance", true);

  if (!contactsError && maintenanceContacts) {
    const existingTypeNames = new Set(currentTypes.map((entry) => entry.name.trim().toLowerCase()));
    const categoryDisplayNames = new Map<string, string>();

    for (const entry of maintenanceContacts) {
      const name = (entry.maintenance_category || entry.role_function || "").trim();
      const normalized = name.toLowerCase();
      if (!name || categoryDisplayNames.has(normalized)) {
        continue;
      }

      categoryDisplayNames.set(normalized, name);
    }

    const missingCategories = [...categoryDisplayNames.keys()].filter((name) => !existingTypeNames.has(name));

    if (missingCategories.length > 0) {
      await admin.from("maintenance_types").insert(
        missingCategories.map((name) => ({
          name: categoryDisplayNames.get(name) ?? name,
          threshold_days: 30
        }))
      );
    }
  }

  const { data, error } = await admin
    .from("maintenance_types")
    .select("id,name,threshold_days,created_by,created_at")
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((entry) => ({
      id: entry.id,
      name: entry.name,
      thresholdDays: entry.threshold_days,
      createdByUserId: (entry.created_by as string | null) ?? undefined,
      createdAt: entry.created_at
    }));
}

export async function getMaintenanceRecords(): Promise<MaintenanceRecord[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const admin = user ? createAdminClient() : null;
  const client = admin ?? supabase;

  const { data, error } = await client
    .from("maintenance_records")
    .select(`
      id,
      scheduled_for,
      created_by,
      created_at,
      maintenance_type:maintenance_types!maintenance_records_maintenance_type_id_fkey(id,name),
      creator:profiles!maintenance_records_created_by_fkey(full_name)
    `)
    .order("scheduled_for", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    typeId: (entry.maintenance_type as unknown as { id: string; name: string } | null)?.id ?? "",
    typeName: (entry.maintenance_type as unknown as { id: string; name: string } | null)?.name ?? "Unknown",
    scheduledFor: entry.scheduled_for,
    createdByUserId: entry.created_by,
    createdByName: ((entry.creator as unknown as { full_name: string } | null)?.full_name) ?? "Unknown",
    createdAt: entry.created_at
  }));
}

function mapFeatureRequestRow(entry: {
  id: string;
  requested_by: string;
  request_type: "feature" | "bug";
  title: string;
  description: string;
  status: "pending" | "in_progress" | "declined" | "completed" | "rejected";
  status_email_opt_in: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  requester: unknown;
  reviewer: unknown;
  vote_count?: number;
  voted_by_current_user?: boolean;
}): FeatureRequest {
  return {
    id: entry.id,
    requestedByUserId: entry.requested_by,
    requestedByName: ((entry.requester as { full_name?: string } | null)?.full_name ?? "Unknown").toString(),
    requestedByEmail: ((entry.requester as { email?: string } | null)?.email ?? "").toString(),
    requestType: entry.request_type,
    title: entry.title,
    description: entry.description,
    status: entry.status,
    statusEmailOptIn: entry.status_email_opt_in,
    reviewedByUserId: entry.reviewed_by ?? undefined,
    reviewedByName: ((entry.reviewer as { full_name?: string } | null)?.full_name ?? undefined)?.toString(),
    reviewedAt: entry.reviewed_at ?? undefined,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
    voteCount: entry.vote_count ?? 0,
    votedByCurrentUser: entry.voted_by_current_user ?? false
  };
}

export async function getFeatureRequestVoteCounts(): Promise<Record<string, number>> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {};
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const admin = user ? createAdminClient() : null;
  const client = admin ?? supabase;

  const { data, error } = await client.from("feature_request_votes").select("feature_request_id");

  if (error || !data) {
    return {};
  }

  const voteCounts: Record<string, number> = {};
  for (const vote of data as Array<{ feature_request_id: string }>) {
    voteCounts[vote.feature_request_id] = (voteCounts[vote.feature_request_id] ?? 0) + 1;
  }

  return voteCounts;
}

export async function getMyFeatureRequestVoteIds(userId: string): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const admin = user ? createAdminClient() : null;
  const client = admin ?? supabase;

  const { data, error } = await client.from("feature_request_votes").select("feature_request_id").eq("voted_by", userId);

  if (error || !data) {
    return [];
  }

  return (data as Array<{ feature_request_id: string }>).map((vote) => vote.feature_request_id);
}

export async function getMyFeatureRequests(userId: string): Promise<FeatureRequest[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const admin = user ? createAdminClient() : null;
  const client = admin ?? supabase;

  const { data, error } = await client
    .from("feature_requests")
    .select(`
      id,
      requested_by,
      request_type,
      title,
      description,
      status,
      status_email_opt_in,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      requester:profiles!feature_requests_requested_by_fkey(full_name,email),
      reviewer:profiles!feature_requests_reviewed_by_fkey(full_name)
    `)
    .eq("requested_by", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((entry) =>
    mapFeatureRequestRow(
      entry as {
        id: string;
        requested_by: string;
        request_type: "feature" | "bug";
        title: string;
        description: string;
        status: "pending" | "in_progress" | "declined" | "completed" | "rejected";
        status_email_opt_in: boolean;
        reviewed_by: string | null;
        reviewed_at: string | null;
        created_at: string;
        updated_at: string;
        requester: unknown;
        reviewer: unknown;
      }
    )
  );
}

export async function getPendingFeatureRequests(requestType?: FeatureRequestType): Promise<FeatureRequest[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const admin = user ? createAdminClient() : null;
  const client = admin ?? supabase;

  let query = client
    .from("feature_requests")
    .select(`
      id,
      requested_by,
      request_type,
      title,
      description,
      status,
      status_email_opt_in,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      requester:profiles!feature_requests_requested_by_fkey(full_name,email),
      reviewer:profiles!feature_requests_reviewed_by_fkey(full_name)
    `)
    .eq("status", "pending");

  if (requestType) {
    query = query.eq("request_type", requestType);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((entry) =>
    mapFeatureRequestRow(
      entry as {
        id: string;
        requested_by: string;
        request_type: "feature" | "bug";
        title: string;
        description: string;
        status: "pending" | "in_progress" | "declined" | "completed" | "rejected";
        status_email_opt_in: boolean;
        reviewed_by: string | null;
        reviewed_at: string | null;
        created_at: string;
        updated_at: string;
        requester: unknown;
        reviewer: unknown;
      }
    )
  );
}

export async function getQueuedFeatureRequests(requestType?: FeatureRequestType): Promise<FeatureRequest[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const admin = user ? createAdminClient() : null;
  const client = admin ?? supabase;

  let query = client
    .from("feature_requests")
    .select(`
      id,
      requested_by,
      request_type,
      title,
      description,
      status,
      status_email_opt_in,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      requester:profiles!feature_requests_requested_by_fkey(full_name,email),
      reviewer:profiles!feature_requests_reviewed_by_fkey(full_name)
    `)
    .eq("status", "in_progress");

  if (requestType) {
    query = query.eq("request_type", requestType);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((entry) =>
    mapFeatureRequestRow(
      entry as {
        id: string;
        requested_by: string;
        request_type: "feature" | "bug";
        title: string;
        description: string;
        status: "pending" | "in_progress" | "declined" | "completed" | "rejected";
        status_email_opt_in: boolean;
        reviewed_by: string | null;
        reviewed_at: string | null;
        created_at: string;
        updated_at: string;
        requester: unknown;
        reviewer: unknown;
      }
    )
  );
}

export async function getAllFeatureRequests(): Promise<FeatureRequest[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const admin = user ? createAdminClient() : null;
  const client = admin ?? supabase;

  const { data, error } = await client
    .from("feature_requests")
    .select(`
      id,
      requested_by,
      request_type,
      title,
      description,
      status,
      status_email_opt_in,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      requester:profiles!feature_requests_requested_by_fkey(full_name,email),
      reviewer:profiles!feature_requests_reviewed_by_fkey(full_name)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((entry) =>
    mapFeatureRequestRow(
      entry as {
        id: string;
        requested_by: string;
        request_type: "feature" | "bug";
        title: string;
        description: string;
        status: "pending" | "in_progress" | "declined" | "completed" | "rejected";
        status_email_opt_in: boolean;
        reviewed_by: string | null;
        reviewed_at: string | null;
        created_at: string;
        updated_at: string;
        requester: unknown;
        reviewer: unknown;
      }
    )
  );
}

export async function getMaintenanceNotifications(): Promise<MaintenanceNotification[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const admin = user ? createAdminClient() : null;
  const client = admin ?? supabase;

  const { data, error } = await client
    .from("maintenance_notifications")
    .select(`
      id,
      reservation_id,
      notified_user_id,
      reservation_start_date,
      reservation_end_date,
      triggered_on,
      created_at,
      maintenance_type:maintenance_types!maintenance_notifications_maintenance_type_id_fkey(id,name),
      notified_user:profiles!maintenance_notifications_notified_user_id_fkey(full_name)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    typeId: (entry.maintenance_type as unknown as { id: string; name: string } | null)?.id ?? "",
    typeName: (entry.maintenance_type as unknown as { id: string; name: string } | null)?.name ?? "Unknown",
    notifiedUserId: entry.notified_user_id,
    notifiedUserName: ((entry.notified_user as unknown as { full_name: string } | null)?.full_name) ?? "Unknown",
    reservationId: (entry.reservation_id as string | null) ?? undefined,
    reservationStartDate: entry.reservation_start_date,
    reservationEndDate: entry.reservation_end_date,
    triggeredOn: entry.triggered_on,
    createdAt: entry.created_at
  }));
}

export async function getMaintenanceSummaries(): Promise<MaintenanceSummary[]> {
  const [maintenanceTypes, maintenanceRecords] = await Promise.all([getMaintenanceTypes(), getMaintenanceRecords()]);
  return buildMaintenanceSummaries(maintenanceTypes, maintenanceRecords);
}

export async function getInAppNotificationsForUser(userId: string): Promise<InAppNotification[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const admin = createAdminClient();
  const client = admin ?? supabase;

  const [featureStatusResult, reservationInviteResult, boostResult, readStateResult] = await Promise.all([
    client
      .from("feature_requests")
      .select("id,title,request_type,status,reviewed_at,updated_at")
      .eq("requested_by", userId)
      .in("status", ["in_progress", "declined", "completed", "rejected"]) 
      .order("updated_at", { ascending: false })
      .limit(100),
    client
      .from("reservations")
      .select(`
        id,
        start_date,
        end_date,
        created_at,
        created_by,
        creator:profiles!reservations_created_by_fkey(full_name)
      `)
      .contains("shared_with_user_ids", [userId])
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("feature_request_votes")
      .select(`
        id,
        created_at,
        voted_by,
        feature_request_id,
        voter:profiles!feature_request_votes_voted_by_fkey(full_name),
        request:feature_requests!feature_request_votes_feature_request_id_fkey(id,title,request_type,requested_by)
      `)
      .order("created_at", { ascending: false })
      .limit(200),
    client
      .from("notification_reads")
      .select("notification_id,read_at")
      .eq("user_id", userId)
  ]);

  const readMap = new Map<string, string>();
  for (const row of (readStateResult.data ?? []) as Array<{ notification_id: string; read_at: string }>) {
    if (!row.notification_id) {
      continue;
    }

    readMap.set(row.notification_id, row.read_at);
  }

  const statusToVerb: Record<string, string> = {
    in_progress: "moved to in progress",
    declined: "denied",
    completed: "completed",
    rejected: "rejected"
  };

  const featureStatusNotifications: InAppNotification[] = (featureStatusResult.data ?? []).map((entry) => {
    const status = (entry.status as string) ?? "pending";
    const typeLabel = (entry.request_type as string) === "bug" ? "bug report" : "feature request";
    const statusVerb = statusToVerb[status] ?? "updated";

    return {
      id: `feature-status-${entry.id}-${entry.updated_at}`,
      type: "feature_status",
      title: `Your ${typeLabel} was ${statusVerb}`,
      body: (entry.title as string) ?? "A request you submitted was updated.",
      createdAt: ((entry.reviewed_at as string | null) ?? (entry.updated_at as string)) ?? new Date().toISOString(),
      href: "/feature-requests",
      isRead: false
    };
  });

  const reservationInviteNotifications: InAppNotification[] = (reservationInviteResult.data ?? []).map((entry) => {
    const inviterName = ((entry.creator as unknown as { full_name?: string } | null)?.full_name ?? "Another user").toString();
    const startDate = (entry.start_date as string) ?? "";
    const endDate = (entry.end_date as string) ?? "";

    return {
      id: `reservation-invite-${entry.id}`,
      type: "reservation_invite",
      title: "You have been invited to a reservation",
      body: `${inviterName} invited you for ${startDate} to ${endDate}.`,
      createdAt: (entry.created_at as string) ?? new Date().toISOString(),
      href: "/reservations",
      isRead: false
    };
  });

  const requestBoostNotifications: InAppNotification[] = (boostResult.data ?? [])
    .filter((entry) => {
      const request = entry.request as unknown as { requested_by?: string } | null;
      return request?.requested_by === userId && (entry.voted_by as string) !== userId;
    })
    .map((entry) => {
      const request = entry.request as unknown as { title?: string; request_type?: string } | null;
      const voterName = ((entry.voter as unknown as { full_name?: string } | null)?.full_name ?? "A user").toString();
      const typeLabel = request?.request_type === "bug" ? "bug report" : "request";

      return {
        id: `request-boost-${entry.id}`,
        type: "request_boost",
        title: `${voterName} boosted your ${typeLabel}`,
        body: request?.title ?? "One of your requests received a boost.",
        createdAt: (entry.created_at as string) ?? new Date().toISOString(),
        href: "/feature-requests",
        isRead: false
      };
    });

  return [...featureStatusNotifications, ...reservationInviteNotifications, ...requestBoostNotifications]
    .map((notification) => {
      const readAt = readMap.get(notification.id);
      return {
        ...notification,
        isRead: Boolean(readAt),
        readAt: readAt ?? undefined
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getPendingMaintenanceThresholdApprovals(): Promise<MaintenanceThresholdApproval[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("maintenance_threshold_approvals")
    .select(`
      id,
      maintenance_type_id,
      proposed_threshold_days,
      requested_by,
      status,
      decided_by,
      decided_at,
      created_at,
      maintenance_type:maintenance_types!maintenance_threshold_approvals_maintenance_type_id_fkey(name),
      requester:profiles!maintenance_threshold_approvals_requested_by_fkey(full_name),
      decider:profiles!maintenance_threshold_approvals_decided_by_fkey(full_name)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    maintenanceTypeId: entry.maintenance_type_id,
    maintenanceTypeName: ((entry.maintenance_type as unknown as { name: string } | null)?.name) ?? "Unknown",
    proposedThresholdDays: entry.proposed_threshold_days,
    requestedByUserId: entry.requested_by,
    requestedByName: ((entry.requester as unknown as { full_name: string } | null)?.full_name) ?? "Unknown",
    status: entry.status,
    decidedByUserId: (entry.decided_by as string | null) ?? undefined,
    decidedByName: ((entry.decider as unknown as { full_name: string } | null)?.full_name) ?? undefined,
    decidedAt: (entry.decided_at as string | null) ?? undefined,
    createdAt: entry.created_at
  }));
}
