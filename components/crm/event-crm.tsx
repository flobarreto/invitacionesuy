"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CampaignKind, CampaignPreviewGroup, InvitationGroup } from "@/lib/crm/types"

type Settings = {
  event: { id: string; slug: string; displayName: string; eventAt: string | null; timezone: string }
  messagingEnabled: boolean
  reminder: { enabled: boolean; daysBefore: number; time: string }
  tableNotice: { enabled: boolean; daysBefore: number; time: string; message: string | null }
}

type CampaignPreview = {
  kind: CampaignKind
  groups: CampaignPreviewGroup[]
  eligibleCount: number
  omittedCount: number
  previewHash: string
}

type Campaign = {
  id: string
  kind: CampaignKind
  status: string
  created_at: string
  scheduled_for: string
  message_deliveries: Array<{
    status: string
    is_stale: boolean
    error_code: string | null
    payload: { omittedGuestIds?: string[] } | null
  }>
  message_campaign_alerts: Array<{
    id: string
    code: "missing_table" | "delivery_uncertain" | "requires_review"
    resolved_at: string | null
  }>
}

const CAMPAIGN_LABELS: Record<CampaignKind, string> = {
  invitation: "Invitación",
  reminder: "Recordatorio de RSVP",
  table_notice: "Aviso de mesa",
  table_correction: "Corrección de mesa",
}

const OMITTED_LABELS: Record<CampaignPreviewGroup["reason"], string> = {
  eligible: "Listo para enviar",
  missing_phone: "Sin teléfono",
  missing_consent: "Sin consentimiento",
  suppressed: "Solicitó la baja",
  no_pending_guests: "Ya confirmó",
  no_attending_guests: "Sin asistentes confirmados",
  missing_table: "Falta asignar mesa",
  already_sent: "Ya fue enviado",
  not_stale: "La mesa no cambió",
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? "No se pudo completar la operación")
  return body as T
}

export function EventCrm({ eventId }: { eventId: string }) {
  const base = `/api/admin/events/${eventId}`
  const [groups, setGroups] = useState<InvitationGroup[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const [groupName, setGroupName] = useState("")
  const [memberNames, setMemberNames] = useState([""])
  const [phone, setPhone] = useState("")
  const [labels, setLabels] = useState("")
  const [consent, setConsent] = useState(false)

  const [csv, setCsv] = useState("")
  const [csvPreview, setCsvPreview] = useState<any>(null)
  const [campaignKind, setCampaignKind] = useState<CampaignKind>("invitation")
  const [customMessage, setCustomMessage] = useState("")
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [campaignPreview, setCampaignPreview] = useState<CampaignPreview | null>(null)
  const idempotencyKey = useRef<string | null>(null)
  const manualGuestIdempotencyKey = useRef<string | null>(null)
  const csvImportIdempotencyKey = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [guestData, settingsData, campaignData] = await Promise.all([
        api<{ groups: InvitationGroup[] }>(`${base}/guests`),
        api<Settings>(`${base}/messaging-settings`),
        api<{ campaigns: Campaign[] }>(`${base}/campaigns`),
      ])
      setGroups(guestData.groups)
      setSelectedGroupIds((current) => {
        const available = new Set(guestData.groups.map((group) => group.id))
        return current.filter((groupId) => available.has(groupId))
      })
      setSettings(settingsData)
      setCampaigns(campaignData.campaigns)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el CRM")
    } finally {
      setLoading(false)
    }
  }, [base])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void load()
    })
    return () => {
      active = false
    }
  }, [load])

  const run = async (operation: () => Promise<void>) => {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await operation()
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : "Error inesperado")
    } finally {
      setBusy(false)
    }
  }

  const addGuest = () =>
    run(async () => {
      const members = memberNames.map((name) => name.trim()).filter(Boolean)
      if (members.length === 0) throw new Error("Agregá al menos un integrante")
      await api(`${base}/guests`, {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: manualGuestIdempotencyKey.current ??= crypto.randomUUID(),
          groupName: groupName.trim() || members.join(" y "),
          phone,
          consent,
          consentSource: "manual",
          labels: labels.split(/[;|]/).map((label) => label.trim()).filter(Boolean),
          members: members.map((name) => ({ name, attendanceStatus: "pending" })),
        }),
      })
      setGroupName("")
      setMemberNames([""])
      setPhone("")
      setLabels("")
      setConsent(false)
      manualGuestIdempotencyKey.current = null
      setNotice("Invitado agregado.")
      await load()
    })

  const previewCsv = () =>
    run(async () => {
      const preview = await api(`${base}/guests/import/preview`, {
        method: "POST",
        body: JSON.stringify({ csv, defaultCallingCode: "598" }),
      })
      csvImportIdempotencyKey.current = null
      setCsvPreview(preview)
    })

  const importCsv = () =>
    run(async () => {
      if (!csvPreview || csvPreview.invalidRows > 0) throw new Error("Corregí el CSV antes de importarlo")
      const result = await api<{ importedGuests: number }>(`${base}/guests/import`, {
        method: "POST",
        body: JSON.stringify({
          csv,
          defaultCallingCode: "598",
          idempotencyKey: csvImportIdempotencyKey.current ??= crypto.randomUUID(),
        }),
      })
      setNotice(`${result.importedGuests} invitados importados.`)
      setCsv("")
      setCsvPreview(null)
      csvImportIdempotencyKey.current = null
      await load()
    })

  const previewMessages = () =>
    run(async () => {
      const groupIds = selectedGroupIds.length > 0 ? selectedGroupIds : undefined
      const preview = await api<CampaignPreview>(`${base}/campaigns/preview`, {
        method: "POST",
        body: JSON.stringify({
          kind: campaignKind,
          groupIds,
          customMessage: customMessage || undefined,
        }),
      })
      idempotencyKey.current = crypto.randomUUID()
      setCampaignPreview(preview)
    })

  const sendCampaign = () =>
    run(async () => {
      if (!campaignPreview || campaignPreview.kind !== campaignKind) {
        throw new Error("Previsualizá nuevamente la campaña")
      }
      if (!window.confirm(`Se encolarán ${campaignPreview.eligibleCount} mensajes. ¿Continuar?`)) return
      const result = await api<{ idempotentReplay: boolean }>(`${base}/campaigns`, {
        method: "POST",
        body: JSON.stringify({
          kind: campaignKind,
          groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
          idempotencyKey: idempotencyKey.current ?? crypto.randomUUID(),
          customMessage: customMessage || undefined,
          confirmedPreviewHash: campaignPreview.previewHash,
        }),
      })
      setNotice(result.idempotentReplay ? "La campaña ya estaba encolada." : "Campaña encolada.")
      setCampaignPreview(null)
      idempotencyKey.current = null
      await load()
    })

  const saveSettings = () =>
    run(async () => {
      if (!settings) return
      const updated = await api<Settings>(`${base}/messaging-settings`, {
        method: "PATCH",
        body: JSON.stringify(settings),
      })
      setSettings(updated)
      setNotice("Automatizaciones guardadas.")
    })

  const updateMemberName = (index: number, value: string) => {
    manualGuestIdempotencyKey.current = null
    setMemberNames((current) => current.map((name, memberIndex) => (
      memberIndex === index ? value : name
    )))
  }

  const toggleGroupSelection = (groupId: string, checked: boolean) => {
    setSelectedGroupIds((current) => checked
      ? Array.from(new Set([...current, groupId]))
      : current.filter((selectedId) => selectedId !== groupId))
    setCampaignPreview(null)
    idempotencyKey.current = null
  }

  if (loading) return <main className="mx-auto max-w-7xl p-6">Cargando CRM…</main>

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">CRM · {settings?.event.displayName ?? "Evento"}</h1>
        <p className="text-sm text-muted-foreground">Invitados, campañas y automatizaciones de WhatsApp.</p>
      </div>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agregar invitado</CardTitle>
            <CardDescription>El consentimiento debe haber sido declarado por los novios.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del grupo"><Input placeholder="Opcional; ej. Familia Pérez" value={groupName} onChange={(event) => { manualGuestIdempotencyKey.current = null; setGroupName(event.target.value) }} /></Field>
            <Field label="WhatsApp"><Input placeholder="099 123 456" value={phone} onChange={(event) => { manualGuestIdempotencyKey.current = null; setPhone(event.target.value) }} /></Field>
            <Field label="Etiquetas"><Input placeholder="Familia; Amigos" value={labels} onChange={(event) => { manualGuestIdempotencyKey.current = null; setLabels(event.target.value) }} /></Field>
            <div className="space-y-2 sm:col-span-2">
              <Label>Integrantes del grupo</Label>
              {memberNames.map((name, index) => (
                <div className="flex gap-2" key={index}>
                  <Input
                    aria-label={`Integrante ${index + 1}`}
                    placeholder={index === 0 ? "Nombre y apellido" : `Integrante ${index + 1}`}
                    value={name}
                    onChange={(event) => updateMemberName(index, event.target.value)}
                  />
                  {memberNames.length > 1 && (
                    <Button
                      aria-label={`Quitar integrante ${index + 1}`}
                      type="button"
                      variant="outline"
                      onClick={() => { manualGuestIdempotencyKey.current = null; setMemberNames((current) => current.filter((_, memberIndex) => memberIndex !== index)) }}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={memberNames.length >= 30}
                onClick={() => { manualGuestIdempotencyKey.current = null; setMemberNames((current) => [...current, ""]) }}
              >
                Agregar integrante
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={consent} onCheckedChange={(checked) => { manualGuestIdempotencyKey.current = null; setConsent(checked === true) }} />
              Los novios confirman que pueden contactar a este número
            </label>
            <Button disabled={busy || !memberNames.some((name) => name.trim()) || !phone} onClick={() => void addGuest()} className="sm:col-span-2">Agregar grupo</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Importar CSV</CardTitle>
            <CardDescription>Columnas: nombre, teléfono, grupo, etiquetas y consentimiento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" accept=".csv,text/csv" onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void file.text().then((content) => { csvImportIdempotencyKey.current = null; setCsv(content); setCsvPreview(null) })
            }} />
            <Textarea rows={5} value={csv} onChange={(event) => { csvImportIdempotencyKey.current = null; setCsv(event.target.value); setCsvPreview(null) }} placeholder="nombre,telefono,grupo,etiquetas,consentimiento" />
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy || !csv} onClick={() => void previewCsv()}>Previsualizar</Button>
              <Button disabled={busy || !csvPreview || csvPreview.invalidRows > 0} onClick={() => void importCsv()}>Importar</Button>
            </div>
            {csvPreview && <p className="text-sm">{csvPreview.validRows} válidas · {csvPreview.invalidRows} con errores · {csvPreview.groups} grupos</p>}
            {csvPreview?.rows?.filter((row: any) => row.issues.length > 0).slice(0, 8).map((row: any) => (
              <p key={row.rowNumber} className="text-xs text-amber-700">Fila {row.rowNumber}: {row.issues.map((issue: any) => issue.message).join(" ")}</p>
            ))}
          </CardContent>
        </Card>
      </div>

      {settings && <Card>
        <CardHeader><CardTitle>Automatizaciones</CardTitle><CardDescription>Se calculan en {settings.event.timezone} a partir de la fecha canónica del evento.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={settings.messagingEnabled} onCheckedChange={(checked) => setSettings({ ...settings, messagingEnabled: checked === true })} />Habilitar WhatsApp para la boda</label>
          <AutomationFields label="Recordatorio de confirmación" enabled={settings.reminder.enabled} days={settings.reminder.daysBefore} time={settings.reminder.time} maxDays={365} onChange={(value) => setSettings({ ...settings, reminder: value })} />
          <AutomationFields label="Aviso de mesa" enabled={settings.tableNotice.enabled} days={settings.tableNotice.daysBefore} time={settings.tableNotice.time} maxDays={30} onChange={(value) => setSettings({ ...settings, tableNotice: { ...settings.tableNotice, ...value } })} />
          <Field label="Mensaje de los novios"><Textarea value={settings.tableNotice.message ?? ""} maxLength={1500} onChange={(event) => setSettings({ ...settings, tableNotice: { ...settings.tableNotice, message: event.target.value } })} /></Field>
          <Button disabled={busy} onClick={() => void saveSettings()} className="md:col-span-3">Guardar automatizaciones</Button>
        </CardContent>
      </Card>}

      <Card>
        <CardHeader><CardTitle>Enviar campaña</CardTitle><CardDescription>Siempre se previsualizan elegibles y omitidos antes de encolar.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tipo">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={campaignKind} onChange={(event) => { setCampaignKind(event.target.value as CampaignKind); setCampaignPreview(null); idempotencyKey.current = null }}>
                {Object.entries(CAMPAIGN_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Texto personalizado"><Input value={customMessage} maxLength={1500} onChange={(event) => { setCustomMessage(event.target.value); setCampaignPreview(null); idempotencyKey.current = null }} /></Field>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{selectedGroupIds.length > 0 ? `${selectedGroupIds.length} grupos seleccionados` : "Todos los grupos"}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => { setSelectedGroupIds(groups.map((group) => group.id)); setCampaignPreview(null); idempotencyKey.current = null }}>Seleccionar todos</Button>
            <Button type="button" size="sm" variant="ghost" disabled={selectedGroupIds.length === 0} onClick={() => { setSelectedGroupIds([]); setCampaignPreview(null); idempotencyKey.current = null }}>Limpiar selección</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void previewMessages()}>{selectedGroupIds.length > 0 ? "Previsualizar seleccionados" : "Previsualizar todos"}</Button>
            <Button disabled={busy || !campaignPreview || campaignPreview.eligibleCount === 0} onClick={() => void sendCampaign()}>Enviar a {campaignPreview?.eligibleCount ?? 0}</Button>
          </div>
          {campaignPreview && <div className="max-h-64 space-y-1 overflow-auto rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">{campaignPreview.eligibleCount} elegibles · {campaignPreview.omittedCount} omitidos</p>
            {campaignPreview.groups.map((group) => <div key={group.groupId} className="flex items-center justify-between gap-3 text-sm"><span>{group.displayName}</span><Badge variant={group.eligible ? "default" : "secondary"}>{OMITTED_LABELS[group.reason]}</Badge></div>)}
          </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historial de campañas</CardTitle><CardDescription>Estados auditables sin guardar el texto ni el teléfono en logs.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {campaigns.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay campañas.</p>}
          {campaigns.map((campaign) => {
            const counts = campaign.message_deliveries.reduce<Record<string, number>>((result, delivery) => {
              result[delivery.status] = (result[delivery.status] ?? 0) + 1
              return result
            }, {})
            const stale = campaign.message_deliveries.filter((delivery) => delivery.is_stale).length
            const missingTables = campaign.message_deliveries.reduce(
              (sum, delivery) => sum + (delivery.payload?.omittedGuestIds?.length ?? 0),
              0,
            )
            const openAlerts = campaign.message_campaign_alerts?.filter((alert) => !alert.resolved_at) ?? []
            const uncertain = openAlerts.filter((alert) => alert.code === "delivery_uncertain").length
            const review = openAlerts.filter((alert) => alert.code === "requires_review").length
            return <div key={campaign.id} className="rounded-md border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{CAMPAIGN_LABELS[campaign.kind]}</strong><Badge variant="outline">{campaign.status}</Badge></div><p className="mt-1 text-muted-foreground">{Object.entries(counts).map(([status, count]) => `${status}: ${count}`).join(" · ") || "Sin entregas"}{stale > 0 ? ` · ${stale} avisos desactualizados` : ""}{missingTables > 0 ? ` · ${missingTables} confirmados sin mesa al enviar` : ""}{uncertain > 0 ? ` · ${uncertain} entregas para revisión` : ""}{review > 0 ? ` · ${review} conversaciones para revisión` : ""}</p></div>
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invitados ({groups.reduce((sum, group) => sum + group.guests.length, 0)})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {groups.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay invitados.</p>}
          {groups.map((group) => <div key={group.id} className="rounded-md border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-2"><Checkbox aria-label={`Seleccionar ${group.displayName}`} checked={selectedGroupIds.includes(group.id)} onCheckedChange={(checked) => toggleGroupSelection(group.id, checked === true)} /><strong>{group.displayName}</strong></label><span className="text-sm text-muted-foreground">{group.phoneE164 ?? "Sin teléfono"}</span></div><p className="mt-1 text-sm">{group.guests.map((guest) => `${guest.name} · ${guest.attendanceStatus}`).join(" · ")}</p>{group.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{group.tags.map((tag) => <Badge key={tag.id} variant="secondary">{tag.name}</Badge>)}</div>}</div>)}
        </CardContent>
      </Card>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>
}

function AutomationFields({ label, enabled, days, time, maxDays, onChange }: {
  label: string
  enabled: boolean
  days: number
  time: string
  maxDays: number
  onChange: (value: { enabled: boolean; daysBefore: number; time: string }) => void
}) {
  return <div className="space-y-2 rounded-md border p-3"><label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={enabled} onCheckedChange={(checked) => onChange({ enabled: checked === true, daysBefore: days, time })} />{label}</label><div className="flex gap-2"><Input aria-label="Días antes" type="number" min={0} max={maxDays} value={days} onChange={(event) => onChange({ enabled, daysBefore: Number(event.target.value), time })} /><Input aria-label="Hora" type="time" value={time} onChange={(event) => onChange({ enabled, daysBefore: days, time: event.target.value })} /></div><p className="text-xs text-muted-foreground">{days} días antes, a las {time}</p></div>
}
