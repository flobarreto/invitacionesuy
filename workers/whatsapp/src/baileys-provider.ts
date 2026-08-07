import type {
  MessagingProvider,
  ProviderInboundMessage,
  ProviderMessageStatus,
  ProviderSendResult,
} from "../../../lib/whatsapp/types"
import { phoneToWhatsAppJid } from "../../../lib/crm/phone"
import { operationalErrorMessage } from "../../../lib/whatsapp/send-outcome"
import { SupabaseAuthStateStore } from "./auth-store"
import {
  EncryptedInboundSpool,
  type InboundSpoolEnvelope,
} from "./inbound-spool"

type AnyRecord = Record<string, any>

export class BaileysProvider implements MessagingProvider {
  private socket: AnyRecord | null = null
  private connected = false
  private reconnectEnabled = true
  private connectionGeneration = 0
  private connecting: Promise<void> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private inboundReplayTimer: ReturnType<typeof setTimeout> | null = null
  private inboundTail: Promise<void> = Promise.resolve()
  private readonly inboundHandlers: Array<(message: ProviderInboundMessage) => Promise<void>> = []
  private readonly statusHandlers: Array<(status: ProviderMessageStatus) => Promise<void>> = []

  constructor(
    private readonly authStore: SupabaseAuthStateStore,
    private readonly onQr: (qr: string | null) => Promise<void>,
    private readonly inboundSpool: EncryptedInboundSpool,
  ) {}

  onInbound(handler: (message: ProviderInboundMessage) => Promise<void>) {
    this.inboundHandlers.push(handler)
  }

  onStatus(handler: (status: ProviderMessageStatus) => Promise<void>) {
    this.statusHandlers.push(handler)
  }

  isConnected() {
    return this.connected
  }

  async connect() {
    this.reconnectEnabled = true
    // A socket remains non-null while Baileys is negotiating or waiting for a
    // QR scan. Opening another one would race auth writes and replace listeners.
    if (this.socket) return
    if (this.connecting) return this.connecting
    this.connecting = this.openSocket().finally(() => {
      this.connecting = null
    })
    return this.connecting
  }

  private async openSocket() {
    // The computed import keeps the optional provider outside the Next.js bundle.
    const packageName = "@whiskeysockets/baileys"
    const baileys = (await import(packageName)) as AnyRecord
    if (!this.reconnectEnabled) return
    const makeWASocket = baileys.default
    const creds = (await this.authStore.get<AnyRecord>("creds")) ?? baileys.initAuthCreds()
    const connectionGeneration = ++this.connectionGeneration
    const auth = {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const values = await this.authStore.getKeys(type, ids)
          if (type === "app-state-sync-key") {
            const fromObject = baileys.proto?.Message?.AppStateSyncKeyData?.fromObject
            if (fromObject) {
              for (const [id, value] of Object.entries(values)) values[id] = fromObject(value)
            }
          }
          return values
        },
        set: async (data: Record<string, Record<string, unknown | null>>) => {
          if (this.connectionGeneration !== connectionGeneration) return
          await this.authStore.setKeys(data)
        },
      },
    }

    const logger = {
      level: "silent",
      child: () => logger,
      trace() {},
      debug() {},
      info() {},
      warn() {},
      error() {},
      fatal() {},
    }
    const socket = makeWASocket({
      auth,
      logger,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    }) as AnyRecord
    this.socket = socket

    socket.ev.on("creds.update", (update: AnyRecord) => {
      void this.runEvent("creds_update", async () => {
        if (this.socket !== socket) return
        Object.assign(creds, update)
        await this.authStore.set("creds", creds)
      })
    })
    socket.ev.on("connection.update", (update: AnyRecord) => {
      void this.runEvent("connection_update", async () => {
        if (this.socket !== socket) return
        if (update.qr) await this.onQr(update.qr)
        if (update.connection === "open") {
          this.connected = true
          await this.onQr(null)
          await this.queueInbound(() => this.replayInboundSpool())
        }
        if (update.connection === "close") {
          this.connected = false
          if (this.inboundReplayTimer) clearTimeout(this.inboundReplayTimer)
          this.inboundReplayTimer = null
          this.socket = null
          this.connectionGeneration += 1
          const statusCode = update.lastDisconnect?.error?.output?.statusCode
          try {
            if (statusCode === baileys.DisconnectReason?.loggedOut) {
              // Logged-out Signal credentials cannot be reused. Clear the encrypted
              // server-side store and reconnect so a fresh platform-admin QR appears.
              await this.authStore.clearAll()
              await this.onQr(null)
            }
          } finally {
            if (this.reconnectEnabled) this.scheduleReconnect()
          }
        }
      })
    })
    socket.ev.on("messages.upsert", ({ messages, type }: AnyRecord) => {
      void this.runEvent("messages_upsert", async () => {
        if (this.socket !== socket) return
        if (type !== "notify") return
        const envelopes: InboundSpoolEnvelope[] = (Array.isArray(messages) ? messages : [])
          .map((message: AnyRecord): InboundSpoolEnvelope | null =>
            this.toInboundEnvelope(message),
          )
          .filter((envelope: InboundSpoolEnvelope | null): envelope is InboundSpoolEnvelope =>
            envelope !== null,
          )
        if (envelopes.length === 0) return
        await this.queueInbound(async () => {
          // Persist the whole provider batch before dispatching any entry. A DB
          // outage can then be replayed without relying on Baileys redelivery.
          await Promise.all(envelopes.map((envelope) => this.inboundSpool.enqueue(envelope)))
          await this.replayInboundSpool()
        })
      })
    })
    socket.ev.on("messages.update", (updates: AnyRecord[]) => {
      void this.runEvent("messages_update", async () => {
        if (this.socket !== socket) return
        for (const update of updates ?? []) {
          const id = update.key?.id
          const numericStatus = Number(update.update?.status)
          if (!id || !Number.isFinite(numericStatus) || numericStatus < 2) continue
          const status: ProviderMessageStatus["status"] =
            numericStatus >= 4 ? "read" : numericStatus === 3 ? "delivered" : "sent"
          await Promise.all(
            this.statusHandlers.map((handler) =>
              handler({ id, status, occurredAt: new Date() }),
            ),
          )
        }
      })
    })
  }

  private async runEvent(scope: string, operation: () => Promise<void>) {
    try {
      await operation()
    } catch (error) {
      console.error(`whatsapp_provider_${scope}_error`, operationalErrorMessage(error))
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, 5_000)
  }

  private toInboundEnvelope(message: AnyRecord): InboundSpoolEnvelope | null {
    if (message.key?.fromMe || !message.key?.id || !message.key?.remoteJid) return null
    const text =
      message.message?.conversation ??
      message.message?.extendedTextMessage?.text ??
      message.message?.buttonsResponseMessage?.selectedDisplayText ??
      message.message?.listResponseMessage?.title ??
      ""
    if (!text.trim()) return null

    return {
      providerMessageId: String(message.key.id),
      remoteJid: String(message.key.remoteJid),
      text,
      quotedMessageId:
        message.message?.extendedTextMessage?.contextInfo?.stanzaId ?? null,
      receivedAt: new Date(
        Number(message.messageTimestamp ?? Date.now() / 1000) * 1000,
      ).toISOString(),
    }
  }

  private async dispatchInbound(envelope: InboundSpoolEnvelope) {
    let remoteJid = envelope.remoteJid
    if (remoteJid.endsWith("@lid")) {
      remoteJid =
        (await this.socket?.signalRepository?.lidMapping?.getPNForLID?.(remoteJid)) ?? remoteJid
    }
    const phone = remoteJid.endsWith("@s.whatsapp.net")
      ? `+${remoteJid.split("@")[0].replace(/\D/g, "")}`
      : ""
    if (!phone) throw new Error("LID_MAPPING_UNAVAILABLE")

    const inbound: ProviderInboundMessage = {
      id: envelope.providerMessageId,
      from: phone,
      text: envelope.text,
      quotedMessageId: envelope.quotedMessageId,
      receivedAt: new Date(envelope.receivedAt),
    }
    await Promise.all(this.inboundHandlers.map((handler) => handler(inbound)))
  }

  private queueInbound(operation: () => Promise<void>) {
    const next = this.inboundTail.then(operation, operation)
    this.inboundTail = next.catch(() => undefined)
    return next
  }

  private async replayInboundSpool() {
    try {
      await this.inboundSpool.replay((envelope) => this.dispatchInbound(envelope))
    } catch (error) {
      this.scheduleInboundReplay()
      throw error
    }
  }

  private scheduleInboundReplay() {
    if (!this.connected || this.inboundReplayTimer) return
    this.inboundReplayTimer = setTimeout(() => {
      this.inboundReplayTimer = null
      void this.queueInbound(() => this.replayInboundSpool()).catch((error) => {
        console.error("whatsapp_inbound_spool_retry_error", operationalErrorMessage(error))
      })
    }, 5_000)
  }

  async sendText(phoneE164: string, text: string): Promise<ProviderSendResult> {
    if (!this.socket || !this.connected) throw new Error("PROVIDER_DISCONNECTED")
    const socket = this.socket
    const generation = this.connectionGeneration
    let timeout: ReturnType<typeof setTimeout> | null = null
    let sent
    try {
      sent = await Promise.race([
        socket.sendMessage(phoneToWhatsAppJid(phoneE164), { text }),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error("PROVIDER_TIMEOUT")), 30_000)
        }),
      ])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
    if (this.socket !== socket || this.connectionGeneration !== generation) {
      throw new Error("PROVIDER_FENCE_LOST")
    }
    if (!sent?.key?.id) throw new Error("PROVIDER_NO_MESSAGE_ID")
    return { id: sent.key.id, acceptedAt: new Date() }
  }

  async disconnect() {
    this.reconnectEnabled = false
    this.connectionGeneration += 1
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    if (this.inboundReplayTimer) clearTimeout(this.inboundReplayTimer)
    this.inboundReplayTimer = null
    this.connected = false
    this.socket?.end?.(new Error("Worker shutdown"))
    this.socket = null
  }
}
