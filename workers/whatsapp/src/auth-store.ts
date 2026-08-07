import type { SupabaseClient } from "@supabase/supabase-js"
import { decryptSecret, encryptSecret } from "../../../lib/whatsapp/crypto"

function serialize(value: unknown) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === "bigint") return { __type: "bigint", value: item.toString() }
    if (Buffer.isBuffer(item) || item instanceof Uint8Array) {
      return { __type: "bytes", value: Buffer.from(item).toString("base64") }
    }
    return item
  })
}

function deserialize<T>(value: string): T {
  return JSON.parse(value, (_key, item) => {
    if (item?.type === "Buffer" && Array.isArray(item.data)) return Buffer.from(item.data)
    if (item?.__type === "bigint") return BigInt(item.value)
    if (item?.__type === "bytes") return Buffer.from(item.value, "base64")
    return item
  }) as T
}

export class SupabaseAuthStateStore {
  private mutationTail: Promise<void> = Promise.resolve()

  constructor(
    private readonly client: SupabaseClient,
    private readonly encryptionKey: string,
  ) {}

  private enqueue(operation: () => Promise<void>) {
    const next = this.mutationTail.then(operation, operation)
    this.mutationTail = next.catch(() => undefined)
    return next
  }

  private async getRaw<T>(key: string): Promise<T | null> {
    const { data, error } = await this.client
      .from("whatsapp_auth_state")
      .select("encrypted_value")
      .eq("storage_key", key)
      .maybeSingle()
    if (error) throw new Error(`auth_state_read:${error.message}`)
    if (!data) return null
    return deserialize<T>(decryptSecret(data.encrypted_value, this.encryptionKey))
  }

  private async setRaw(key: string, value: unknown) {
    const encryptedValue = encryptSecret(serialize(value), this.encryptionKey)
    const { error } = await this.client.from("whatsapp_auth_state").upsert(
      {
        storage_key: key,
        encrypted_value: encryptedValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "storage_key" },
    )
    if (error) throw new Error(`auth_state_write:${error.message}`)
  }

  private async removeRaw(key: string) {
    const { error } = await this.client.from("whatsapp_auth_state").delete().eq("storage_key", key)
    if (error) throw new Error(`auth_state_delete:${error.message}`)
  }

  async get<T>(key: string): Promise<T | null> {
    await this.mutationTail
    return this.getRaw<T>(key)
  }

  async set(key: string, value: unknown) {
    return this.enqueue(() => this.setRaw(key, value))
  }

  async remove(key: string) {
    return this.enqueue(() => this.removeRaw(key))
  }

  async clearAll() {
    return this.enqueue(async () => {
      const { data, error: readError } = await this.client
        .from("whatsapp_auth_state")
        .select("storage_key")
      if (readError) throw new Error(`auth_state_list:${readError.message}`)
      const keys = (data ?? []).map((row) => row.storage_key as string)
      if (keys.length === 0) return
      const { error: deleteError } = await this.client
        .from("whatsapp_auth_state")
        .delete()
        .in("storage_key", keys)
      if (deleteError) throw new Error(`auth_state_reset:${deleteError.message}`)
    })
  }

  async getKeys(type: string, ids: string[]) {
    await this.mutationTail
    const entries = await Promise.all(
      ids.map(async (id) => [id, await this.getRaw(`key:${type}:${id}`)] as const),
    )
    return Object.fromEntries(entries.filter(([, value]) => value !== null))
  }

  async setKeys(data: Record<string, Record<string, unknown | null>>) {
    return this.enqueue(async () => {
      for (const [type, entries] of Object.entries(data)) {
        for (const [id, value] of Object.entries(entries)) {
          if (value === null) await this.removeRaw(`key:${type}:${id}`)
          else await this.setRaw(`key:${type}:${id}`, value)
        }
      }
    })
  }
}
