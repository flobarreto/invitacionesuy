import { unavailable } from "@/lib/crm/errors"
import { supabaseAdmin } from "@/lib/supabase"

export async function getMessagingSettings(eventId: string) {
  if (!supabaseAdmin) throw unavailable("Supabase no configurado")
  const { data, error } = await supabaseAdmin
    .from("events")
    .select(`
      id,slug,display_name,event_at,timezone,messaging_enabled,
      reminder_enabled,reminder_days_before,reminder_time,
      table_notice_enabled,table_notice_days_before,table_notice_time,table_notice_message
    `)
    .eq("id", eventId)
    .single()
  if (error) throw unavailable(error.message)
  return {
    event: {
      id: data.id,
      slug: data.slug,
      displayName: data.display_name,
      eventAt: data.event_at,
      timezone: data.timezone,
    },
    messagingEnabled: data.messaging_enabled,
    reminder: {
      enabled: data.reminder_enabled,
      daysBefore: data.reminder_days_before,
      time: String(data.reminder_time).slice(0, 5),
    },
    tableNotice: {
      enabled: data.table_notice_enabled,
      daysBefore: data.table_notice_days_before,
      time: String(data.table_notice_time).slice(0, 5),
      message: data.table_notice_message,
    },
  }
}

export async function updateMessagingSettings(
  eventId: string,
  settings: {
    messagingEnabled: boolean
    reminder: { enabled: boolean; daysBefore: number; time: string }
    tableNotice: { enabled: boolean; daysBefore: number; time: string; message: string | null }
  },
) {
  if (!supabaseAdmin) throw unavailable("Supabase no configurado")
  const { error } = await supabaseAdmin
    .from("events")
    .update({
      messaging_enabled: settings.messagingEnabled,
      reminder_enabled: settings.reminder.enabled,
      reminder_days_before: settings.reminder.daysBefore,
      reminder_time: settings.reminder.time,
      table_notice_enabled: settings.tableNotice.enabled,
      table_notice_days_before: settings.tableNotice.daysBefore,
      table_notice_time: settings.tableNotice.time,
      table_notice_message: settings.tableNotice.message || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
  if (error) throw unavailable(error.message)
  return getMessagingSettings(eventId)
}

