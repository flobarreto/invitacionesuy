import { createHash, randomUUID } from "node:crypto"
import { constants } from "node:fs"
import {
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  unlink,
} from "node:fs/promises"
import { join } from "node:path"
import { decryptSecret, encryptSecret } from "../../../lib/whatsapp/crypto"

const FILE_SUFFIX = ".inbound"

export type InboundSpoolEnvelope = {
  providerMessageId: string
  remoteJid: string
  text: string
  quotedMessageId: string | null
  receivedAt: string
}

/**
 * Small encrypted write-ahead spool for provider events. Railway must mount the
 * configured directory on a persistent volume. A provider event is removed only
 * after its semantic command is durable in Postgres (or already registered).
 */
export class EncryptedInboundSpool {
  constructor(
    private readonly directory: string,
    private readonly encryptionKey: string,
  ) {}

  async enqueue(envelope: InboundSpoolEnvelope) {
    assertEnvelope(envelope)
    await this.ensureDirectory()
    const target = this.pathFor(envelope.providerMessageId)
    const temporary = join(this.directory, `.${randomUUID()}.tmp`)
    const encrypted = encryptSecret(JSON.stringify(envelope), this.encryptionKey)
    const handle = await open(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    )
    try {
      await handle.writeFile(encrypted, "utf8")
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, target)
    await this.syncDirectory()
  }

  async replay(handler: (envelope: InboundSpoolEnvelope) => Promise<void>) {
    await this.ensureDirectory()
    const files = (await readdir(this.directory))
      .filter((file) => file.endsWith(FILE_SUFFIX))
      .sort()
    let failures = 0
    for (const file of files) {
      try {
        const encrypted = await readFile(join(this.directory, file), "utf8")
        const envelope = JSON.parse(
          decryptSecret(encrypted, this.encryptionKey),
        ) as InboundSpoolEnvelope
        assertEnvelope(envelope)
        if (file !== this.fileFor(envelope.providerMessageId)) {
          throw new Error("INBOUND_SPOOL_ID_MISMATCH")
        }
        await handler(envelope)
        await unlink(join(this.directory, file))
      } catch {
        // Keep every failed encrypted entry for the next replay. Continue so an
        // unresolved @lid mapping cannot block unrelated RSVP responses.
        failures += 1
      }
    }
    if (failures > 0) throw new Error("INBOUND_SPOOL_REPLAY_PENDING")
    if (files.length > 0) await this.syncDirectory()
  }

  private async ensureDirectory() {
    if (!this.directory.startsWith("/")) {
      throw new Error("INBOUND_SPOOL_DIRECTORY_NOT_ABSOLUTE")
    }
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
  }

  private fileFor(providerMessageId: string) {
    return `${createHash("sha256").update(providerMessageId).digest("hex")}${FILE_SUFFIX}`
  }

  private pathFor(providerMessageId: string) {
    return join(this.directory, this.fileFor(providerMessageId))
  }

  private async syncDirectory() {
    const handle = await open(this.directory, constants.O_RDONLY)
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  }
}

function assertEnvelope(value: InboundSpoolEnvelope) {
  if (
    !value
    || typeof value.providerMessageId !== "string"
    || value.providerMessageId.length < 1
    || value.providerMessageId.length > 500
    || typeof value.remoteJid !== "string"
    || value.remoteJid.length < 3
    || value.remoteJid.length > 500
    || typeof value.text !== "string"
    || value.text.length > 10_000
    || (value.quotedMessageId !== null && typeof value.quotedMessageId !== "string")
    || !Number.isFinite(Date.parse(value.receivedAt))
  ) {
    throw new Error("INVALID_INBOUND_SPOOL_ENVELOPE")
  }
}
