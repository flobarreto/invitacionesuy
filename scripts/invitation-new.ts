import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { invitationConfigSchema } from "../lib/invitations/schema"
import type { InvitationDefinition } from "../lib/invitations/types"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const configPath = path.join(projectRoot, "lib/invitations/config.json")

type Arguments = {
  slug?: string
  preset?: string
  names?: string
  date?: string
  deadline?: string
}

const ARGUMENT_NAMES = new Set<keyof Arguments>([
  "slug",
  "preset",
  "names",
  "date",
  "deadline",
])

function parseArguments(values: string[]): Arguments {
  const args: Arguments = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value?.startsWith("--")) continue
    const key = value.slice(2) as keyof Arguments
    if (!ARGUMENT_NAMES.has(key)) {
      throw new Error(`Opción desconocida: --${key}.`)
    }
    const next = values[index + 1]
    if (!next || next.startsWith("--")) {
      throw new Error(`Falta el valor de --${key}.`)
    }
    args[key] = next
    index += 1
  }
  return args
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toLocaleUpperCase("es") + part.slice(1))
    .join(" ")
}

function inferCoupleNames(slug: string): string {
  const names = slug.split("-").map(titleCase)
  return names.length === 2 ? names.join(" & ") : names.join(" ")
}

function toLegacyEventKey(slug: string): string {
  return `boda${slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}`
}

function assertOffsetDate(value: string | undefined, option: string) {
  if (value && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error(
      `${option} debe ser ISO 8601 con zona, por ejemplo 2027-03-20T20:00:00-03:00.`,
    )
  }
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2))
  const slug = args.slug
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("--slug es obligatorio y debe usar kebab-case.")
  }
  if ((args.preset ?? "editorial") !== "editorial") {
    throw new Error("Preset desconocido. Por ahora está disponible: editorial.")
  }
  assertOffsetDate(args.date, "--date")
  assertOffsetDate(args.deadline, "--deadline")

  const parsed = invitationConfigSchema.parse(
    JSON.parse(await readFile(configPath, "utf8")),
  ) as InvitationDefinition[]
  if (parsed.some((definition) => definition.slug === slug)) {
    throw new Error(`Ya existe una invitación con slug ${slug}.`)
  }

  const isPublished = Boolean(args.date)
  const coupleNames = args.names ?? inferCoupleNames(slug)
  const closesAt = args.deadline ?? args.date ?? null
  const definition: InvitationDefinition = {
    id: slug,
    eventKey: slug,
    slug,
    aliases: [],
    status: isPublished ? "published" : "draft",
    renderer: "preset-editorial",
    variant: "editorial",
    coupleNames,
    metadata: {
      title: coupleNames,
      description: args.date ? `Invitación de ${coupleNames}` : "",
      image: null,
    },
    event: {
      startsAt: args.date ?? null,
      timezone: "America/Montevideo",
    },
    rsvp: {
      enabled: isPublished,
      opensAt: null,
      closesAt,
    },
    capabilities: {
      rsvp: isPublished,
      calendar: isPublished,
      tableSearch: false,
    },
    calendar: {
      title: `Boda ${coupleNames}`,
      durationMinutes: 480,
      details: "¡Guardate la fecha de nuestro casamiento para compartir con nosotros!",
      location: null,
    },
    assets: {
      basePath: `/invitations/${slug}`,
      preview: null,
    },
    legacy: {
      rsvpEventKey: toLegacyEventKey(slug),
      rsvpTable: `boda_${slug.replaceAll("-", "_")}`,
      routes: [],
    },
  }

  const assetDirectory = path.join(projectRoot, "public/invitations", slug)
  const assetReadme = path.join(assetDirectory, "README.md")
  if (await pathExists(assetReadme)) {
    throw new Error(`Ya existe ${path.relative(projectRoot, assetReadme)}.`)
  }

  invitationConfigSchema.parse([...parsed, definition])
  await mkdir(assetDirectory, { recursive: true })
  await writeFile(
    assetReadme,
    `# Assets de ${coupleNames}\n\nGuardá aquí las imágenes y fuentes propias de la invitación.\n`,
    { encoding: "utf8", flag: "wx" },
  )

  const migrationDirectory = path.join(projectRoot, "supabase/migrations")
  await mkdir(migrationDirectory, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)
  const migrationPath = path.join(
    migrationDirectory,
    `${timestamp}_seed_event_${slug.replaceAll("-", "_")}.sql`,
  )
  const rsvpStatus = !args.date
    ? "scheduled"
    : closesAt && Date.parse(closesAt) <= Date.now()
      ? "closed"
      : "open"
  const eventAtSql = args.date ? `${sqlString(args.date)}::timestamptz` : "null"
  const deadlineSql = closesAt
    ? `${sqlString(closesAt)}::timestamptz`
    : "null"
  const metadataSql = sqlString(
    JSON.stringify({ invitationId: slug, renderer: "preset-editorial" }),
  )
  const migration = `-- Generated by npm run invitation:new. events.id remains database-owned UUID.\ninsert into public.events (\n  slug, display_name, event_at, timezone, rsvp_status, rsvp_deadline, legacy_table_name, metadata\n)\nvalues (\n  ${sqlString(slug)},\n  ${sqlString(coupleNames)},\n  ${eventAtSql},\n  'America/Montevideo',\n  '${rsvpStatus}',\n  ${deadlineSql},\n  ${sqlString(definition.legacy.rsvpTable)},\n  ${metadataSql}::jsonb\n)\non conflict (slug) do update set\n  display_name = excluded.display_name,\n  event_at = excluded.event_at,\n  timezone = excluded.timezone,\n  rsvp_status = excluded.rsvp_status,\n  rsvp_deadline = excluded.rsvp_deadline,\n  legacy_table_name = excluded.legacy_table_name,\n  metadata = public.events.metadata || excluded.metadata,\n  updated_at = now();\n`
  await writeFile(migrationPath, migration, { encoding: "utf8", flag: "wx" })

  await writeFile(
    configPath,
    `${JSON.stringify([...parsed, definition], null, 2)}\n`,
    "utf8",
  )

  console.log(
    isPublished
      ? `✓ Invitación ${slug} creada y publicada.`
      : `✓ Borrador ${slug} creado con assets y seed. Completá fecha y deadline antes de publicarlo.`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
