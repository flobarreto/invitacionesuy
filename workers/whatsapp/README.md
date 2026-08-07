# Invitia WhatsApp worker

Servicio Node persistente para Railway. Reclama entregas con `FOR UPDATE SKIP LOCKED`,
mantiene una única réplica activa mediante lease, limita el ritmo y procesa respuestas
de recordatorios sin exponer teléfonos ni cuerpos en logs.

Las respuestas no envían mensajes desde el callback entrante: asistencia, estado,
resolución y una acción semántica quedan en una transacción. El dispatcher reclama
esa cola durable y aplica también a preguntas/resúmenes/BAJA la allowlist, el tope
horario y la espera aleatoria. La cola nunca guarda el cuerpo completo.

Los eventos entrantes pendientes conservan solamente el teléfono cifrado y el
comando semántico. Si Supabase falla, el lease activo los retoma con backoff; al
quinto intento pasan a revisión junto con su conversación. Los recibos del provider
también se guardan antes de actualizar una entrega, por lo que un `delivered/read`
que llegue antes que el ID de envío no se pierde. Un timeout posterior a invocar a
WhatsApp queda `uncertain` y nunca se reenvía automáticamente.

## Advertencia operativa

Baileys usa el protocolo de WhatsApp Web y no es una API oficial. La versión está
fijada en `7.0.0-rc13`, pero debe validarse nuevamente en staging antes de cada
despliegue. Los propios mantenedores desaconsejan spam y mensajería masiva. Mantener
el provider detrás de `MessagingProvider` permite migrar a Meta Cloud API sin cambiar
campañas ni conversaciones.

## Variables de entorno

- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: proyecto que contiene todas las migraciones versionadas del repositorio.
- `INVITIA_ENCRYPTION_KEY`: secreto largo y estable para tokens, credenciales Signal y QR. Rotarlo requiere una migración de cifrado.
- `PHONE_HASH_SECRET`: HMAC para teléfonos en eventos entrantes; si falta usa `INVITIA_ENCRYPTION_KEY`.
- `PUBLIC_APP_URL`: origen público, por ejemplo `https://invitia.uy`.
- `WHATSAPP_GLOBAL_ENABLED`: debe ser exactamente `true` para iniciar envíos.
- `WHATSAPP_ALLOWLIST`: lista E.164 separada por comas. Una entrada inválida detiene el arranque; nunca se ignora silenciosamente.
- `WHATSAPP_ALLOW_ALL`: debe ser exactamente `true` para operar sin allowlist y no puede combinarse con ella. Usarlo únicamente tras aprobar el piloto.
- `WHATSAPP_MIN_DELAY_MS` / `WHATSAPP_MAX_DELAY_MS`: valores iniciales `8000` y `15000`.
- `WHATSAPP_HOURLY_LIMIT`: valor inicial `200`.
- `PORT`: servidor HTTP, valor inicial `3001`. `/health` indica que el proceso
  está vivo y `/ready` devuelve `200` únicamente cuando Baileys está conectado.

La web también necesita `INVITIA_ENCRYPTION_KEY` para generar enlaces y
`RATE_LIMIT_SECRET` para las APIs públicas.

## Railway

Configurar `workers/whatsapp` como Root Directory del servicio. Ejecutar una sola
réplica. El lease evita una segunda réplica activa durante reinicios, pero no es una
razón para escalar horizontalmente.

Si WhatsApp revoca la sesión (`loggedOut`), el worker elimina las credenciales y
Signal keys cifradas que ya no sirven, se reconecta y publica un QR nuevo para el
administrador de plataforma. No borra credenciales desde el endpoint web.

Flujo recomendado: número exclusivo de staging + allowlist, envío a 20 teléfonos,
una boda piloto, revisión de estados y recién entonces quitar la allowlist.
