import { access, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { invitationConfigSchema } from "../lib/invitations/schema"
import { normalizeInvitationLookup } from "../lib/invitations/registry"
import type { InvitationDefinition } from "../lib/invitations/types"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const configPath = path.join(projectRoot, "lib/invitations/config.json")

type ValidationResult = {
  definitions: InvitationDefinition[]
  warnings: string[]
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function publicFile(assetPath: string): string {
  return path.join(projectRoot, "public", assetPath.replace(/^\//, ""))
}

export async function validateInvitationConfig(): Promise<ValidationResult> {
  const parsedJson: unknown = JSON.parse(await readFile(configPath, "utf8"))
  const result = invitationConfigSchema.safeParse(parsedJson)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
      .join("\n")
    throw new Error(`Configuración de invitaciones inválida:\n${details}`)
  }

  const definitions = result.data as InvitationDefinition[]
  const warnings: string[] = []
  const ids = new Set<string>()
  const slugs = new Set<string>()
  const lookupOwners = new Map<string, string>()
  const legacyEvents = new Map<string, InvitationDefinition>()

  for (const definition of definitions) {
    if (ids.has(definition.id)) throw new Error(`ID duplicado: ${definition.id}`)
    if (slugs.has(definition.slug)) {
      throw new Error(`Slug canónico duplicado: ${definition.slug}`)
    }
    ids.add(definition.id)
    slugs.add(definition.slug)

    for (const value of [
      definition.slug,
      ...definition.aliases,
      ...definition.legacy.routes,
    ]) {
      const lookup = normalizeInvitationLookup(value)
      const owner = lookupOwners.get(lookup)
      if (owner && owner !== definition.id) {
        throw new Error(
          `Alias "${value}" colisiona entre ${owner} y ${definition.id}.`,
        )
      }
      lookupOwners.set(lookup, definition.id)
    }

    const previousLegacyEvent = legacyEvents.get(
      definition.legacy.rsvpEventKey,
    )
    if (
      previousLegacyEvent &&
      (previousLegacyEvent.eventKey !== definition.eventKey ||
        previousLegacyEvent.legacy.rsvpTable !== definition.legacy.rsvpTable)
    ) {
      throw new Error(
        `El evento RSVP ${definition.legacy.rsvpEventKey} apunta a definiciones incompatibles.`,
      )
    }
    legacyEvents.set(definition.legacy.rsvpEventKey, definition)

    if (definition.status === "draft") {
      warnings.push(`${definition.slug}: borrador no publicado.`)
      continue
    }

    if (definition.legacy.routes.length > 0) {
      const existingLegacyRoute = await Promise.all(
        definition.legacy.routes.map(async (route) => {
          const routePath = route.replace(/^\//, "")
          return exists(path.join(projectRoot, "app", routePath, "page.tsx"))
        }),
      )
      if (!existingLegacyRoute.some(Boolean)) {
        throw new Error(
          `${definition.slug}: no existe ninguna de sus rutas legacy.`,
        )
      }
    }

    for (const asset of [definition.assets.preview, definition.metadata.image]) {
      if (asset && !(await exists(publicFile(asset)))) {
        throw new Error(`${definition.slug}: no existe el asset ${asset}.`)
      }
    }
  }

  return { definitions, warnings }
}

async function main() {
  const { definitions, warnings } = await validateInvitationConfig()
  for (const warning of warnings) console.warn(`⚠ ${warning}`)
  console.log(`✓ ${definitions.length} invitaciones válidas.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
