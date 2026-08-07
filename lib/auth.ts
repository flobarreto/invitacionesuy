import { createHash, createHmac, randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { INVALID_ADMIN_PASSWORD_HASH } from "@/lib/auth-password"
import { supabaseAdmin } from "@/lib/supabase"
import { assertMutationRequest, RequestSecurityError } from "@/lib/security"
import {
  inspectLegacyRsvpRelation,
  type LegacyRsvpTableName,
} from "@/lib/legacy-rsvp-relation"
import { getInvitationDefinition } from "@/lib/invitations/registry"

export { assertMutationRequest, RequestSecurityError }

export type AdminRole = "platform_admin" | "couple_admin"

type AdminRecord = {
  id: string
  username: string
  password?: string
  table_name: string | null
}

type SessionRecord = {
  id: string
  admin_id: string
  expires_at: string
  last_seen_at: string
  revoked_at: string | null
}

export type AuthenticatedAdmin = {
  sessionId: string
  adminId: string
  username: string
  tableName: string | null
  expiresAt: string
}

export type EventAccess = {
  username: string
  adminId: string
  eventId: string
  role: AdminRole
}

export type LegacyAdminTransitionCode =
  | "LEGACY_CUTOVER_COMPLETE"
  | "LEGACY_DUAL_WRITE_DISABLED"

export type LegacyAdminTransitionPayload = {
  error: string
  code: LegacyAdminTransitionCode
  eventId: string
  redirectTo: string
}

type SessionContext = {
  userAgent?: string | null
  ipAddress?: string | null
}

export class AuthError extends Error {
  constructor(
    message:
      | "Unauthorized"
      | "Forbidden"
      | "Event not found"
      | "Authentication unavailable"
      | "Admin event mapping missing"
      | "Legacy admin transition required",
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = "AuthError"
  }
}

export class LegacyAdminTransitionError extends AuthError {
  readonly redirectTo: string

  constructor(
    readonly eventId: string,
    readonly transitionCode: LegacyAdminTransitionCode,
  ) {
    super("Legacy admin transition required", 409, transitionCode)
    this.name = "LegacyAdminTransitionError"
    this.redirectTo = `/admin/events/${eventId}/crm`
  }
}

export function getLegacyAdminTransitionPayload(
  error: unknown,
): LegacyAdminTransitionPayload | null {
  if (!(error instanceof LegacyAdminTransitionError)) return null
  return {
    error: "Este panel fue migrado al CRM del evento.",
    code: error.transitionCode,
    eventId: error.eventId,
    redirectTo: error.redirectTo,
  }
}

const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-invitia_admin_session"
    : "invitia_admin_session"
const LEGACY_SESSION_COOKIE = "admin_username"
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const MIN_SESSION_TTL_SECONDS = 60 * 60
const MAX_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const LAST_SEEN_WRITE_INTERVAL_MS = 15 * 60 * 1000

function db() {
  if (!supabaseAdmin) {
    throw new AuthError(
      "Authentication unavailable",
      503,
      "AUTH_SERVICE_UNAVAILABLE",
    )
  }
  return supabaseAdmin
}

function normalizedUsername(username: string) {
  return username.trim()
}

function sessionTtlSeconds() {
  const configured = Number.parseInt(process.env.ADMIN_SESSION_TTL_SECONDS ?? "", 10)
  if (!Number.isFinite(configured)) return DEFAULT_SESSION_TTL_SECONDS
  return Math.min(
    MAX_SESSION_TTL_SECONDS,
    Math.max(MIN_SESSION_TTL_SECONDS, configured),
  )
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

function hashFingerprint(value: string | null | undefined) {
  if (!value) return null
  const secret = process.env.ADMIN_SESSION_FINGERPRINT_SECRET
  if (!secret) return null
  if (Buffer.byteLength(secret.trim(), "utf8") < 32) {
    throw new AuthError(
      "Authentication unavailable",
      503,
      "INSECURE_ADMIN_SESSION_FINGERPRINT_SECRET",
    )
  }
  return createHmac("sha256", secret).update(value, "utf8").digest("hex")
}

async function findAdminByUsername(
  username: string,
  includePassword = false,
): Promise<AdminRecord | null> {
  const fields = includePassword
    ? "id,username,password,table_name"
    : "id,username,table_name"
  const { data, error } = await db()
    .from("admin")
    .select(fields)
    .eq("username", normalizedUsername(username))
    .maybeSingle()

  if (error) {
    console.error("Unable to read administrator", { code: error.code })
    throw new AuthError(
      "Authentication unavailable",
      503,
      "AUTH_SERVICE_UNAVAILABLE",
    )
  }

  return data as unknown as AdminRecord | null
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const admin = await findAdminByUsername(username, true)
  const passwordHash = admin?.password ?? INVALID_ADMIN_PASSWORD_HASH

  try {
    const valid = await bcrypt.compare(password, passwordHash)
    return Boolean(admin && valid)
  } catch (error) {
    console.error("Unable to verify administrator password", {
      kind: error instanceof Error ? error.name : typeof error,
    })
    throw new AuthError(
      "Authentication unavailable",
      503,
      "AUTH_SERVICE_UNAVAILABLE",
    )
  }
}

async function getCurrentSession(): Promise<AuthenticatedAdmin | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token || token.length < 32 || token.length > 256) return null

  const now = new Date()
  const tokenHash = hashSessionToken(token)
  const { data: sessionData, error: sessionError } = await db()
    .from("admin_sessions")
    .select("id,admin_id,expires_at,last_seen_at,revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", now.toISOString())
    .maybeSingle()

  if (sessionError) {
    console.error("Unable to read administrator session", { code: sessionError.code })
    throw new AuthError(
      "Authentication unavailable",
      503,
      "AUTH_SERVICE_UNAVAILABLE",
    )
  }
  if (!sessionData) return null

  const session = sessionData as SessionRecord
  const { data: adminData, error: adminError } = await db()
    .from("admin")
    .select("id,username,table_name")
    .eq("id", session.admin_id)
    .maybeSingle()

  if (adminError) {
    console.error("Unable to resolve administrator session", { code: adminError.code })
    throw new AuthError(
      "Authentication unavailable",
      503,
      "AUTH_SERVICE_UNAVAILABLE",
    )
  }
  if (!adminData) return null

  const lastSeen = Date.parse(session.last_seen_at)
  if (!Number.isNaN(lastSeen) && now.getTime() - lastSeen > LAST_SEEN_WRITE_INTERVAL_MS) {
    const { error } = await db()
      .from("admin_sessions")
      .update({ last_seen_at: now.toISOString() })
      .eq("id", session.id)
      .is("revoked_at", null)
    if (error) console.error("Unable to touch administrator session", { code: error.code })
  }

  const admin = adminData as unknown as AdminRecord
  return {
    sessionId: session.id,
    adminId: admin.id,
    username: admin.username,
    tableName: admin.table_name,
    expiresAt: session.expires_at,
  }
}

export async function getCurrentUser(): Promise<string | null> {
  return (await getCurrentSession())?.username ?? null
}

export async function getUserTableName(username: string): Promise<string | null> {
  const admin = await findAdminByUsername(username)
  return admin?.table_name ?? null
}

export async function setUserSession(
  username: string,
  context: SessionContext = {},
): Promise<AuthenticatedAdmin> {
  const admin = await findAdminByUsername(username)
  if (!admin) throw new AuthError("Unauthorized", 401, "UNAUTHORIZED")

  const token = randomBytes(32).toString("base64url")
  const tokenHash = hashSessionToken(token)
  const ttlSeconds = sessionTtlSeconds()
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)

  const { data, error } = await db()
    .from("admin_sessions")
    .insert({
      admin_id: admin.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      user_agent_hash: hashFingerprint(context.userAgent),
      ip_hash: hashFingerprint(context.ipAddress),
    })
    .select("id,admin_id,expires_at,last_seen_at,revoked_at")
    .single()

  if (error || !data) {
    console.error("Unable to create administrator session", { code: error?.code })
    throw new AuthError(
      "Authentication unavailable",
      503,
      "AUTH_SERVICE_UNAVAILABLE",
    )
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds,
    expires: expiresAt,
  })
  cookieStore.delete(LEGACY_SESSION_COOKIE)

  return {
    sessionId: String(data.id),
    adminId: admin.id,
    username: admin.username,
    tableName: admin.table_name,
    expiresAt: String(data.expires_at),
  }
}

export async function clearUserSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token && !supabaseAdmin) {
    throw new AuthError(
      "Authentication unavailable",
      503,
      "AUTH_SERVICE_UNAVAILABLE",
    )
  }

  if (token && supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from("admin_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashSessionToken(token))
      .is("revoked_at", null)
    if (error) {
      console.error("Unable to revoke administrator session", { code: error.code })
      throw new AuthError(
        "Authentication unavailable",
        503,
        "AUTH_SERVICE_UNAVAILABLE",
      )
    }
  }

  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete(LEGACY_SESSION_COOKIE)
}

export async function requireAuth(): Promise<string> {
  const session = await getCurrentSession()
  if (!session) throw new AuthError("Unauthorized", 401, "UNAUTHORIZED")
  return session.username
}

export async function requireAuthWithTable(
  operation: "read" | "write" = "read",
): Promise<{
  username: string
  tableName: LegacyRsvpTableName
  adminId: string
  eventId: string
  role: AdminRole
  legacyReadsEnabled: true
  legacyDualWriteEnabled: boolean
}> {
  const session = await getCurrentSession()
  if (!session) throw new AuthError("Unauthorized", 401, "UNAUTHORIZED")
  if (!session.tableName) {
    throw new AuthError(
      "Admin event mapping missing",
      500,
      "ADMIN_EVENT_MAPPING_MISSING",
    )
  }

  let tableInspection
  try {
    tableInspection = await inspectLegacyRsvpRelation(session.tableName)
  } catch (error) {
    console.error("Unable to inspect legacy RSVP relation", {
      error: error instanceof Error ? error.name : "unknown",
    })
    throw new AuthError(
      "Authentication unavailable",
      503,
      "AUTH_SERVICE_UNAVAILABLE",
    )
  }
  if (!tableInspection.valid) {
    console.error("Rejected unsafe legacy administrator mapping", {
      adminId: session.adminId,
      reason: tableInspection.reason,
    })
    throw new AuthError(
      "Admin event mapping missing",
      500,
      "UNSAFE_LEGACY_TABLE_MAPPING",
    )
  }
  const tableName = tableInspection.tableName

  const { data, error } = await db()
    .from("events")
    .select("id,slug,event_admins!inner(role,active,admin_id)")
    .eq("legacy_table_name", tableName)
    .eq("event_admins.admin_id", session.adminId)
    .eq("event_admins.active", true)
    .maybeSingle()

  if (error) {
    console.error("Unable to resolve legacy event mapping", { code: error.code })
    throw new AuthError(
      "Authentication unavailable",
      503,
      "AUTH_SERVICE_UNAVAILABLE",
    )
  }

  const relation = data as unknown as {
    id?: string
    slug?: string
    event_admins?: Array<{ role?: AdminRole }> | { role?: AdminRole }
  } | null
  const roleRow = Array.isArray(relation?.event_admins)
    ? relation?.event_admins[0]
    : relation?.event_admins

  if (!relation?.id || !roleRow?.role) {
    throw new AuthError(
      "Admin event mapping missing",
      500,
      "ADMIN_EVENT_MAPPING_MISSING",
    )
  }

  const knownInvitation = relation.slug
    ? getInvitationDefinition(relation.slug)
    : undefined
  if (
    knownInvitation &&
    knownInvitation.legacy.rsvpTable !== tableName
  ) {
    console.error("Rejected mismatched canonical legacy mapping", {
      eventId: relation.id,
    })
    throw new AuthError(
      "Admin event mapping missing",
      500,
      "UNSAFE_LEGACY_TABLE_MAPPING",
    )
  }

  const { data: migrationStateData, error: migrationStateError } = await db()
    .from("event_migration_state")
    .select("legacy_reads_enabled,legacy_dual_write_enabled")
    .eq("event_id", relation.id)
    .maybeSingle()

  if (migrationStateError || !migrationStateData) {
    console.error("Unable to resolve legacy migration state", {
      eventId: relation.id,
      code: migrationStateError?.code,
    })
    throw new AuthError(
      "Authentication unavailable",
      503,
      "LEGACY_MIGRATION_STATE_UNAVAILABLE",
    )
  }

  const migrationState = migrationStateData as {
    legacy_reads_enabled?: boolean
    legacy_dual_write_enabled?: boolean
  }
  if (migrationState.legacy_reads_enabled !== true) {
    throw new LegacyAdminTransitionError(
      relation.id,
      "LEGACY_CUTOVER_COMPLETE",
    )
  }
  if (operation === "write" && migrationState.legacy_dual_write_enabled !== true) {
    throw new LegacyAdminTransitionError(
      relation.id,
      "LEGACY_DUAL_WRITE_DISABLED",
    )
  }

  return {
    username: session.username,
    tableName,
    adminId: session.adminId,
    eventId: relation.id,
    role: roleRow.role,
    legacyReadsEnabled: true,
    legacyDualWriteEnabled: migrationState.legacy_dual_write_enabled === true,
  }
}

export async function requireEventAccess(eventId: string): Promise<EventAccess> {
  const session = await getCurrentSession()
  if (!session) throw new AuthError("Unauthorized", 401, "UNAUTHORIZED")

  const { data: event, error: eventError } = await db()
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle()

  if (eventError) {
    // Invalid UUIDs and unknown IDs are both public "not found" outcomes;
    // database outages remain a service error.
    if (eventError.code === "22P02") {
      throw new AuthError("Event not found", 404, "EVENT_NOT_FOUND")
    }
    console.error("Unable to resolve event", { code: eventError.code })
    throw new AuthError(
      "Authentication unavailable",
      503,
      "AUTH_SERVICE_UNAVAILABLE",
    )
  }
  if (!event) throw new AuthError("Event not found", 404, "EVENT_NOT_FOUND")

  const { data, error } = await db()
    .from("event_admins")
    .select("event_id,role")
    .eq("admin_id", session.adminId)
    .eq("active", true)

  if (error) {
    console.error("Unable to authorize event access", { code: error.code })
    throw new AuthError(
      "Authentication unavailable",
      503,
      "AUTH_SERVICE_UNAVAILABLE",
    )
  }

  const assignments = (data ?? []) as Array<{ event_id: string; role: AdminRole }>
  const direct = assignments.find((assignment) => assignment.event_id === eventId)
  const platform = assignments.find((assignment) => assignment.role === "platform_admin")
  const role = direct?.role === "platform_admin" || platform
    ? "platform_admin"
    : direct?.role

  if (!role) throw new AuthError("Forbidden", 403, "FORBIDDEN")

  return {
    username: session.username,
    adminId: session.adminId,
    eventId,
    role,
  }
}

export async function requirePlatformAdmin(): Promise<{
  username: string
  adminId: string
  role: "platform_admin"
}> {
  const session = await getCurrentSession()
  if (!session) throw new AuthError("Unauthorized", 401, "UNAUTHORIZED")

  const { data, error } = await db()
    .from("event_admins")
    .select("id")
    .eq("admin_id", session.adminId)
    .eq("role", "platform_admin")
    .eq("active", true)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Unable to authorize platform administrator", { code: error.code })
    throw new AuthError(
      "Authentication unavailable",
      503,
      "AUTH_SERVICE_UNAVAILABLE",
    )
  }
  if (!data) throw new AuthError("Forbidden", 403, "FORBIDDEN")

  return {
    username: session.username,
    adminId: session.adminId,
    role: "platform_admin",
  }
}
