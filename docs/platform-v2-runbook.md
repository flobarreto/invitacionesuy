# Invitia Platform v2: runbook de migración y WhatsApp

Este documento describe el pasaje controlado desde las tablas RSVP legacy al modelo
canónico. No autoriza ni automatiza cambios en producción: cada promoción requiere
respaldo restaurable, resultados aprobados en staging y una ventana de rollback.

## 1. Requisitos y responsables

- Usar Node `22.13.1` (archivo `.nvmrc`) y `npm ci`; `package-lock.json` es el único
  lockfile válido.
- Ejecutar las migraciones con una versión fijada de Supabase CLI desde el runner de
  despliegue, nunca con una versión descargada ad hoc durante la ventana.
- Designar antes de empezar: responsable de base, responsable de aplicación,
  responsable del número de WhatsApp y persona que aprueba conteos/ambigüedades.
- Abrir una ventana sin importaciones masivas ni ediciones manuales de planos.
- Confirmar que las claves de staging son distintas de producción. Nunca copiar
  `SUPABASE_SERVICE_ROLE_KEY`, credenciales Signal ni dumps a logs o artefactos
  públicos.
- Mantener `ENABLE_STATIC_INVITATION_EVENT_ADAPTER` ausente o en `false` en staging
  y producción. El valor `true` existe solo para CI/desarrollo sin base; una
  invitación productiva debe leer fecha y estado RSVP desde Supabase o fallar.

## 2. Respaldo y prueba de restauración

Definir `STAGING_DATABASE_URL` en el gestor de secretos de la terminal. No incluirla
en el historial del shell. Crear un directorio de release fuera del repositorio y
generar un dump completo:

```bash
pg_dump "$STAGING_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file invitia-staging-before-v2.dump
shasum -a 256 invitia-staging-before-v2.dump
pg_restore --list invitia-staging-before-v2.dump
```

Guardar juntos el dump, su SHA-256, la versión de PostgreSQL y el hash del commit a
desplegar. Antes del cutover de producción, restaurar ese dump en una base efímera
aislada y ejecutar:

```bash
pg_restore \
  --exit-on-error \
  --no-owner \
  --no-acl \
  --dbname "$RESTORE_DRILL_DATABASE_URL" \
  invitia-staging-before-v2.dump
```

En la base restaurada comparar por lo menos los conteos de todas las tablas RSVP
legacy, `admin`, `tags`, la singular `floor_plan` y, si existe antes de migrar, la
plural `floor_plans`. Exportar también el JSON y `md5(to_jsonb(fila)::text)` de cada
plano como evidencia independiente; `007` generará su propio SHA-256. Abrir una invitación legacy y consultar un
RSVP de muestra. Un archivo que no fue restaurado con éxito no cuenta como respaldo.

Supabase Storage necesita un respaldo separado. Exportar los objetos existentes y
su inventario (bucket, ruta, tamaño y checksum). El dump de PostgreSQL no contiene
los binarios de los planos.

## 3. Orden de migraciones en staging

Primero ejecutar el CI del commit (`invitation:validate`, lint, typecheck, pruebas y
build). Con el respaldo aprobado, revisar que el entorno no tenga migraciones
locales fuera de `supabase/migrations` y aplicar, en este orden, todas las pendientes:

1. `202608050000_floor_plan_legacy_preflight.sql`: si reconoce el prototipo plural
   `floor_plans(admin_username, image_url, opacity, floor_tables)`, lo preserva con
   el nombre `floor_plans_legacy_admin`. Una forma desconocida detiene la migración
   sin renombrar ni sobrescribir nada.
2. `202608050001_core_schema.sql`: eventos, administradores/sesiones, grupos,
   invitados, etiquetas, mesas, planos e historial.
3. `202608050002_crm_whatsapp.sql`: campañas, entregas, conversaciones, cola
   durable de respuestas, supresiones, auth state, leases y funciones del worker.
4. `202608050003_seed_canonical_events.sql`: identidades, fechas y deadlines
   canónicos.
5. `202608050004_legacy_core_backfill.sql`: identidades legacy estables, backfill
   idempotente con compare-and-set y auditoría fuente/destino por evento.
6. `202608050005_seating_functions.sql`: bucket privado para fondos de planos.
7. `202608050006_legacy_dual_write.sql`: guard de escrituras canónicas, trigger
   legacy → canónico, pasada delta y función verificada de cutover.
8. `202608050007_legacy_floor_plan_reconciliation.sql`: captura con checksum ambos
   prototipos, resuelve evento/administrador, reconcilia mesas por código y crea el
   reporte de conflictos sin borrar las fuentes; también instala el guard de cutover
   que consume ese reporte.
9. `202608050008_rate_limit_hardening.sql`: vencimiento y limpieza incremental de
   buckets antiabuso; evita crecimiento persistente por identificadores descartables.
10. `202608050009_legacy_rsvp_relation_guard.sql`: inventario y validación estricta
    de las únicas relaciones RSVP que pueden participar del puente legacy.
11. `202608050010_floor_plan_background_path_hardening.sql`: aislamiento de rutas
    privadas de fondos por evento.
12. `202608050011_legacy_delete_and_cutover.sql`: reconciliación auditada de DELETE,
    guard permanente de escritura legacy y cutover irreversible que apaga lecturas
    y dual-write en la misma transacción.
13. Cualquier migración posterior, estrictamente por número ascendente.

`009` no es un inventario pasivo: compara el OID y el contrato de columnas de cada
relación RSVP autorizada. Antes de aplicarla, exportar `admins.table_name` y
`events.legacy_table_name`; después, revisar `legacy_rsvp_mapping_reviews`. Una
relación recreada, no registrada o con forma inesperada queda fuera del bridge y
puede desactivar la asignación comprometida hasta que un operador la resuelva. `010`
exige rutas canónicas privadas y aisladas por evento para cada fondo de plano. `011`
sustituye el trigger de `006`: durante dual-write reconcilia también los `DELETE` y,
al completar el cutover, retira el trigger de sincronización y deja únicamente el
guard permanente contra nuevas escrituras legacy.

Comandos de control del runner (la URL siempre llega desde secretos):

```bash
supabase migration list --db-url "$STAGING_DATABASE_URL"
supabase db push --db-url "$STAGING_DATABASE_URL"
supabase migration list --db-url "$STAGING_DATABASE_URL"
```

No ejecutar archivos individuales desde el panel SQL: se perdería el historial de
migraciones. Si `db push` falla, detenerse; no marcar una versión como aplicada a
mano. Las fuentes se preservan, pero `009` puede poner mappings inseguros en
cuarentena y `011` retira el trigger dual-write al cortar; eso no reemplaza el
respaldo.

## 4. Conteos, checksums y ambigüedades

La migración `004` ejecuta `migrate_legacy_event` por evento y guarda cada resultado
en `legacy_migration_audit`. La `006` instala los triggers y vuelve a ejecutar una
pasada delta. Verificar el último registro de cada evento:

```sql
with latest as (
  select distinct on (event_id)
    id,
    event_id,
    source_table,
    source_count,
    migrated_guest_count,
    retired_guest_count,
    source_checksum,
    target_checksum,
    status,
    ambiguities,
    migrated_at
  from public.legacy_migration_audit
  order by event_id, migrated_at desc, id desc
)
select
  e.slug,
  latest.source_table,
  latest.source_count,
  latest.migrated_guest_count,
  latest.retired_guest_count,
  latest.source_checksum,
  latest.target_checksum,
  latest.status,
  jsonb_array_length(latest.ambiguities) as ambiguity_count,
  latest.migrated_at
from public.events e
left join latest on latest.event_id = e.id
where e.legacy_table_name is not null
order by e.slug;
```

Bloquear el cutover si falta una fila, `status <> 'completed'`, algún checksum es
nulo, `source_count <> migrated_guest_count`, `source_checksum <> target_checksum`
o `ambiguity_count <> 0`. Repetir la función es seguro y produce una nueva evidencia
con los checksums actuales:

```sql
select e.slug, public.migrate_legacy_event(e.id)
from public.events e
where e.legacy_table_name is not null
order by e.slug;
```

Después de esa pasada no debe haber escrituras legacy sin que aparezcan en canónico.
Hacer un RSVP sintético identificado por evento en staging y verificar su
`legacy_table`/`legacy_id` en `invitation_groups` y `guests`. En un dataset
desechable, borrar también esa fila legacy y comprobar que el invitado canónico no
se elimina: queda `declined`, sin mesa, con `metadata.legacy_deleted`; su grupo deja
de ser elegible, las entregas pendientes se cancelan (o quedan `uncertain` si ya
estaban reclamadas), `attendance_history` se conserva y aparece una fila en
`legacy_rsvp_deletion_audit`. Repetir `migrate_legacy_event`: el conteo/checksum debe
quedar limpio aun con la fuente vacía. Un DELETE canónico directo debe seguir siendo
rechazado durante esta ventana.

Revisar manualmente todas las ambigüedades:

```sql
with latest as (
  select distinct on (event_id)
    id,
    event_id,
    source_table,
    status,
    ambiguities,
    migrated_at
  from public.legacy_migration_audit
  order by event_id, migrated_at desc, id desc
)
select
  e.slug,
  latest.source_table,
  item.value as ambiguity
from latest
join public.events e on e.id = latest.event_id
cross join lateral jsonb_array_elements(latest.ambiguities) item(value)
where latest.status = 'completed'
order by latest.migrated_at desc, e.slug;
```

No reasignar automáticamente casos históricos de Domi a Calas. El endpoint legado
incorrecto de Calas vuelve dudosa la procedencia; esas filas requieren aprobación
humana y una bitácora con ID original, decisión y responsable.

### Reconciliación de planos legacy

La migración `000` no elimina el prototipo plural: lo renombra a
`floor_plans_legacy_admin` únicamente si reconoce sus cuatro columnas. La singular
`floor_plan(table_name, layout)` conserva su nombre. La migración `007` toma una
instantánea JSON completa actual de cada fila en `legacy_floor_plan_sources`, con
checksum; cada versión distinta queda además preservada de forma append-only en
`legacy_floor_plan_source_versions`. Después resuelve el evento así:

- `floor_plan.table_name → events.legacy_table_name`;
- `floor_plans_legacy_admin.admin_username → admin.username → event_admins`, con
  `admin.table_name → events.legacy_table_name` como segunda evidencia.

Si un administrador conduce a más de un evento no se elige uno. Las mesas se
comparan por código normalizado (`code`, `tableNumber` o `table_number`). Definiciones
idénticas de ambos prototipos se fusionan conservando el ID de `seating_tables`; una
diferencia de geometría, capacidad, nombre, código duplicado o forma produce una
incidencia y no sobrescribe la mesa. Un `floor_plans.revision > 0` siempre gana:
significa que el editor canónico ya guardó ese plano.

Revisar primero el último run:

```sql
with latest as (
  select *
  from public.legacy_floor_plan_migration_runs
  order by started_at desc, id desc
  limit 1
)
select
  status,
  source_count,
  mapped_source_count,
  imported_table_count,
  matched_table_count,
  unresolved_issue_count,
  source_checksum,
  target_checksum,
  started_at,
  finished_at
from latest;
```

Después exportar el reporte de ese run:

```sql
with latest as (
  select id
  from public.legacy_floor_plan_migration_runs
  order by started_at desc, id desc
  limit 1
)
select
  report.audit_id,
  report.event_slug,
  report.source_relation,
  report.source_key,
  report.table_code,
  report.status,
  report.issue_code,
  report.details,
  report.resolved_at,
  report.resolved_by,
  report.resolution_note
from public.legacy_floor_plan_reconciliation_report report
join latest on latest.id = report.run_id
order by report.event_slug, report.table_code nulls first, report.created_at;
```

`background_requires_private_copy` significa que la referencia o URL se preservó,
pero el binario debe copiarse desde el inventario de Storage al bucket privado con
la ruta canónica `<event_id>/<uuid-v4>.(jpg|png|webp)`. No se admiten subdirectorios,
segmentos `..`, escapes URL ni otros nombres. Actualizar `floor_plans.background_path` solo
después de verificar checksum y render. Nunca descargar una URL externa dudosa desde
la migración de base. `conflicting_background_definitions` no bloquea la
reconciliación de mesas si las dimensiones coinciden, pero sí exige elegir el fondo
manualmente. `background_opacity_requires_visual_review` preserva el valor viejo en
la auditoría porque el modelo canónico no lo aplica; comparar el render antes de
aprobar esa incidencia.

Una incidencia ambigua se resuelve editando/verificando el resultado canónico y
recién entonces completando `resolved_at`, `resolved_by` y `resolution_note` sobre
la fila exacta de auditoría. Al repetir la reconciliación, esa aprobación se conserva
solo si `issue_fingerprint` sigue idéntico; cualquier cambio en el JSON fuente exige
otra revisión:

```sql
select public.migrate_legacy_floor_plans();

update public.legacy_floor_plan_reconciliation_audit
set
  resolved_at = now(),
  resolved_by = 'RESPONSABLE_APROBADO',
  resolution_note = 'DECISIÓN Y EVIDENCIA DEL RESULTADO CANÓNICO'
where id = ID_DE_INCIDENCIA
  and status = 'issue'
  and resolved_at is null;

select public.migrate_legacy_floor_plans();
```

El trigger `event_migration_state_guard_floor_plan_cutover` bloquea automáticamente
el cambio `legacy_reads_enabled: true → false` mientras el último run tenga una
incidencia sin resolver para ese evento o una incidencia global (por ejemplo, una
fuente sin evento). Por lo tanto también protege a `complete_legacy_event_cutover`
sin reemplazar su lógica RSVP de `006`. La fuente plural archivada y la singular no
se borran en este release. En una base efímera con todas las migraciones aplicadas,
la prueba transaccional se ejecuta con:

```bash
psql "$RESTORE_DRILL_DATABASE_URL" \
  --set ON_ERROR_STOP=1 \
  --file supabase/tests/legacy_floor_plan_reconciliation.sql
```

Controles adicionales antes de habilitar lecturas canónicas:

```sql
select event_id, code, count(*)
from public.seating_tables
group by event_id, code
having count(*) > 1;

select g.id, g.event_id, g.table_id
from public.guests g
join public.seating_tables t on t.id = g.table_id
where g.event_id <> t.event_id;

select e.slug, count(g.id) as guests, count(distinct g.group_id) as groups
from public.events e
left join public.guests g on g.event_id = e.id
group by e.id, e.slug
order by e.slug;
```

Las dos primeras consultas deben devolver cero filas. Exportar todos los resultados
de validación junto con el release, sin teléfonos ni cuerpos de mensajes.

### Consulta pública de mesa

La búsqueda pública de mesa no acepta nombre, teléfono, `group_id` ni texto libre
como credencial. Cada grupo usa un token opaco base64url de 32–256 caracteres,
persistido únicamente como hash. Los endpoints `/api/mesas/...` exigen:

```http
Authorization: Bearer TOKEN_OPACO_DEL_GRUPO
```

Un token ausente, malformado, desconocido o perteneciente a otro evento responde
siempre `404`, sin revelar cuál de esas condiciones ocurrió. La respuesta debe ser
`private, no-store`, con `Referrer-Policy: no-referrer`, y solo puede incluir nombre,
asistencia y mesa de integrantes confirmados del mismo grupo; nunca IDs internos.

El QR puede llevar el token a la landing, que lo extrae y lo envía a la API como
Bearer. No volver a habilitar búsqueda global por nombre ni registrar o exportar el
token en logs, analítica o CSV. En staging, comprobar que una petición sin header
falla antes de consultar Supabase y que un token válido no expone otro grupo.

## 5. Dual-write, feature flags y cutover

`event_migration_state` comienza con `legacy_reads_enabled = true` y
`legacy_dual_write_enabled = true`. Esa es toda la ventana de compatibilidad. El
trigger replica **legacy → canónico**; no
replica escrituras canónicas hacia tablas legacy. Mientras las lecturas legacy están
activas, `guests_guard_legacy_read_canonical_write` bloquea inserts/updates/deletes
directos en `guests`; solo la sincronización legacy puede atravesarlo. Así se evita
tener dos fuentes de verdad antes del corte.

La aplicación consulta este estado antes de cada acceso legacy. Antes de cerrarlo
debe estar desplegada y probada una versión que use lecturas canónicas en
CRM/RSVP/planos. Nunca cambiarlo a `false` con un `UPDATE`: únicamente
`complete_legacy_event_cutover(event_id)` valida la última auditoría RSVP, exige cero
ambigüedades y vuelve a comprobar que esa fuente no cambió. Al actualizar el estado,
el trigger instalado por `007` exige además que la última reconciliación de planos no
tenga incidencias pendientes del evento ni fuentes globales sin resolver. La
migración `011` apaga en esa misma transacción `legacy_reads_enabled` y
`legacy_dual_write_enabled`, elimina el trigger de sincronización y conserva un
guard `BEFORE` que rechaza cualquier INSERT/UPDATE/DELETE posterior en la tabla
legacy. El corte es deliberadamente irreversible por flags.

Secuencia recomendada por evento:

1. Desplegar el esquema con la aplicación todavía leyendo/escribiendo legacy.
2. Confirmar durante una versión que cada escritura legacy aparece en canónico y
   que una escritura directa en `guests` es rechazada por el guard.
3. Resolver todas las ambigüedades RSVP en la fuente o mediante una corrección
   idempotente revisada en la migración. Registrar la decisión no alcanza: la pasada
   siguiente debe producir una lista vacía o el gate rechazará el corte. Resolver y
   auditar también cada incidencia de plano; una diferencia entre prototipos nunca
   se decide automáticamente.
4. Desplegar y probar la versión preparada para lecturas/escrituras canónicas, sin
   activarla todavía. Si esa versión no existe, detener aquí.
5. Abrir una pausa breve de escrituras/importaciones. Ejecutar una pasada final de
   `migrate_legacy_event` y volver a revisar conteos y ambos checksums.
6. Completar el gate para **un solo evento aprobado**:

```sql
select
  event.slug,
  public.complete_legacy_event_cutover(event.id) as cutover
from public.events event
where event.slug = 'SLUG_APROBADO';
```

7. Verificar inmediatamente la aplicación canónica con un RSVP controlado y validar
   CRM/planos antes de reabrir escrituras canónicas. La API y el panel legacy deben
   responder con destino canónico y no tocar su tabla fuente.
8. Mantener las tablas legacy como evidencia de solo lectura durante la versión de
   compatibilidad. No reinstalar su trigger de sincronización ni reabrir flags.

No borrar tablas, columnas, guards ni datos legacy en este release.

## 6. Railway y worker de WhatsApp

Crear un servicio separado con `workers/whatsapp` como Root Directory y una sola
réplica. El lease de base protege reinicios superpuestos, pero no justifica escalar
horizontalmente. El build debe usar el lockfile (`npm ci` + `npm run typecheck`) y el
start command debe ser `npm start`. Verificar el endpoint de salud configurado en
`workers/whatsapp/railway.json` antes de promover.

`/health` es liveness del proceso y puede responder 200 sin conexión a WhatsApp;
`/ready` debe responder 200 únicamente después de vincular Baileys. La promoción y
el monitoreo funcional deben consultar `/ready`, no inferir disponibilidad de envío
desde `/health`.

Configurar mediante secretos de Railway:

- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del entorno correcto.
- `NIXPACKS_NODE_VERSION=22.13.1` para que el servicio con root directory propio use
  la misma versión que la web.
- `INVITIA_ENCRYPTION_KEY` estable, aleatorio y de al menos 32 bytes; rotarlo exige
  migrar tokens, auth state y todo ciphertext creado con la clave anterior.
- `PHONE_HASH_SECRET` independiente del anterior, aleatorio y de al menos 32 bytes.
- `RATE_LIMIT_SECRET` independiente y de al menos 32 bytes. El fallback técnico no
  sustituye configurarlo explícitamente en producción.
- `ADMIN_SESSION_FINGERPRINT_SECRET` independiente y de al menos 32 bytes cuando se
  usa fingerprint de sesión; un valor configurado demasiado corto falla cerrado.
- `PUBLIC_APP_URL` con HTTPS y sin barra final.
- `WHATSAPP_GLOBAL_ENABLED=false` al desplegar.
- `WHATSAPP_ALLOWLIST` con teléfonos E.164 separados por coma.
- `WHATSAPP_ALLOW_ALL=false`; el worker exige una allowlist válida al habilitarse.
  Tras el piloto, quitar la lista y cambiar este valor explícitamente a `true`;
  configurar ambas opciones a la vez detiene el arranque.
- `WHATSAPP_MIN_DELAY_MS=8000`, `WHATSAPP_MAX_DELAY_MS=15000` y
  `WHATSAPP_HOURLY_LIMIT=200`.
- `PORT` según Railway.

Vincular el QR únicamente desde una sesión `platform_admin`. Confirmar que el auth
state cifrado sobrevive un redeploy, que una segunda réplica no obtiene el lease y
que los logs no contienen teléfonos ni cuerpos completos.

El callback entrante persiste primero `whatsapp_inbound_events`; un consumidor
durable los reclama con lease, `SKIP LOCKED` y backoff. La misma transacción que
cambia asistencia/conversación marca el evento procesado y crea un
`whatsapp_outbound_jobs` con una acción semántica, sin cuerpo. Si la transacción
falla, el inbound continúa pendiente; tras cinco intentos pasa a revisión junto con
la conversación. Las respuestas entrantes nunca llaman a `sendMessage` directamente.

Los receipts se persisten primero en `whatsapp_provider_status_events`, incluso si
el `provider_message_id` todavía no quedó asociado a la entrega. Al marcar el envío,
el worker reproduce los receipts pendientes. La progresión `sent → delivered → read`
es monótona: un evento tardío o fuera de orden no puede degradar el estado. Una
entrega con timeout posterior al envío queda `uncertain`, no se reintenta a ciegas y
deja la conversación en revisión.

El dispatcher único renderiza los jobs y los reclama con `SKIP LOCKED`; por eso
preguntas siguientes, resúmenes y confirmaciones de BAJA también respetan allowlist,
espera de 8–15 segundos y máximo horario. Los logs no incluyen teléfonos ni cuerpos:
el inbound durable conserva solo ciphertext/hash y el comando normalizado necesario
para procesarlo.

Baileys `7.0.0-rc13` implementa WhatsApp Web y **no es una API oficial**. Sus
mantenedores desaconsejan spam o mensajería masiva. Puede haber bloqueos o cambios
de protocolo; mantener `MessagingProvider` como frontera y planificar Meta Cloud API
como reemplazo. No promover una versión de Baileys sin reconexión y recepción
validadas en staging.

## 7. Allowlist y promoción gradual

1. Usar un número exclusivo de staging y mantener `WHATSAPP_GLOBAL_ENABLED=false`.
2. Cargar consentimiento, fuente y fecha de 20 destinatarios internos. Agregarlos a
   `WHATSAPP_ALLOWLIST` y hacer primero un envío de prueba.
3. Activar el interruptor global solo durante la prueba. Verificar idempotencia,
   tiempos de 8–15 segundos, límite horario, estados, reconexión, `STOP`/`BAJA` y
   que la supresión cancela futuros mensajes. Ejecutar además
   `supabase/tests/whatsapp_outbox.sql` contra la base aislada/restaurada.
4. Desactivar nuevamente el interruptor, revisar alertas y corregir todo fallo
   `uncertain` o conversación ambigua; nunca reintentar manualmente a ciegas.
5. Ejecutar una boda piloto completa: invitación, recordatorio por integrante,
   respuesta, aviso de mesa y una corrección de mesa controlada.
6. Solo con aprobación escrita habilitar más destinatarios. Mantener una campaña
   activa, el máximo de 200/h y el kill switch por evento (`events.messaging_enabled`).
7. Quitar la allowlist únicamente después de la boda piloto, activar explícitamente
   `WHATSAPP_ALLOW_ALL=true`, y mantener monitoreo activo y una persona capaz de
   apagar el worker.

Antes de cada campaña, consultar elegibles/omitidos, hacer un test interno y guardar
el idempotency key. Inmediatamente antes del aviso de mesa, revalidar asistencia y
mesa; los confirmados sin mesa se omiten y generan alerta.

## 8. Rollback

### Aplicación

1. Poner `WHATSAPP_GLOBAL_ENABLED=false` y `events.messaging_enabled=false` para el
   evento afectado.
2. Pausar el servicio Railway; no borrar su volumen ni `whatsapp_auth_state`.
3. Si `complete_legacy_event_cutover` todavía no fue ejecutado, se puede volver a la
   versión anterior de la aplicación manteniendo ambos flags en `true`; verificar
   antes que el trigger dual-write siga instalado.
4. Si el cutover ya fue ejecutado, **no reabrir los flags ni reinstalar triggers**.
   La base rechaza `legacy_reads_enabled: false → true` porque una escritura canónica
   posterior no tiene réplica inversa confiable. Corregir hacia adelante en canónico
   o desplegar una versión canónica anterior compatible con el mismo esquema.
5. Solo ante corrupción/pérdida confirmada, usar el respaldo/PITR como recuperación
   de desastre coordinada: pausar todos los escritores, preservar primero el estado
   actual y restaurar el conjunto completo en un entorno aislado para comparar. No
   usar un `UPDATE` de flags como atajo de rollback.

No reenviar entregas `sent`, `delivered`, `read` o `uncertain` durante la recuperación.

### Base de datos

Las migraciones preservan las fuentes, pero no todas son neutrales: `000` hace un
único rename no destructivo del prototipo plural reconocido, `009` puede poner en
cuarentena mappings inseguros y `011` retira el trigger dual-write al completar el
corte. Antes del cutover se puede revertir la aplicación; después, la recuperación
normal es una reparación canónica hacia adelante, no flags ni un `DROP`. No renombrar
`floor_plans_legacy_admin` nuevamente a `floor_plans`: ese nombre ya pertenece al
modelo canónico. Una versión antigua que dependiera del prototipo plural necesita un
adaptador explícito o la restauración completa en otro entorno.
Restaurar el dump solo ante pérdida/corrupción confirmada y con autorización del
responsable de base; esa restauración descarta escrituras posteriores al respaldo.
Antes, exportar el estado actual para análisis y definir un punto de recuperación.

Después de la recuperación repetir conteos/checksums, probar un RSVP web y revisar que CRM
y plano muestren la misma asignación. Documentar causa, alcance, mensajes enviados y
decisión de reanudación.

## 9. Checklist de salida

- [ ] CI verde con Node 22.13.1 y `npm ci`.
- [ ] Dump restaurado en una base aislada y Storage inventariado.
- [ ] Migraciones 000–011+ registradas en orden.
- [ ] Conteos y checksums por evento aprobados; ambigüedades resueltas.
- [ ] Último run de planos exportado; fondos privados copiados y cero incidencias
      sin resolver para los eventos aprobados.
- [ ] Domi/Calas revisados manualmente.
- [ ] Un RSVP delta por evento aparece en canónico.
- [ ] El guard rechaza escrituras canónicas antes del corte y la aplicación preparada
      para canónico fue probada; sin ambos no hay cutover.
- [ ] `complete_legacy_event_cutover` —no un `UPDATE` manual— cerró cada evento.
- [ ] Ninguna sesión falsificada ni acceso cruzado entre eventos.
- [ ] CRM y plano coinciden por `guest.table_id`.
- [ ] Worker en una réplica, allowlist activa y kill switches probados.
- [ ] Piloto de 20 destinatarios y una boda piloto aprobados.
- [ ] Reparación hacia adelante y recuperación PITR ensayadas; no existe rollback de
      flags después del cutover.
