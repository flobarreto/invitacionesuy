export type SendFailureOutcome = {
  providerAttempted: boolean
  retryable: boolean
}

export class SendPipelineError extends Error {
  constructor(error: unknown, readonly providerAttempted: boolean) {
    super(operationalErrorMessage(error))
    this.name = "SendPipelineError"
  }
}

export function classifySendFailure(error: unknown): SendFailureOutcome {
  const providerAttempted = error instanceof SendPipelineError
    ? error.providerAttempted
    : false
  return {
    providerAttempted,
    retryable: !providerAttempted && isRetryablePreSend(error),
  }
}

export function isDefinitelyPreSendProviderError(error: unknown) {
  return operationalErrorMessage(error).toUpperCase().includes("PROVIDER_DISCONNECTED")
}

export function operationalErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
        .replace(/\+\d{8,15}/g, "[phone]")
        .replace(/\d{8,15}@(s\.whatsapp\.net|lid)/gi, "[jid]")
        .slice(0, 500)
    : "unknown"
}

function isRetryablePreSend(error: unknown) {
  const message = operationalErrorMessage(error).toUpperCase()
  return [
    "PROVIDER_DISCONNECTED",
    "DELIVERY_CONTEXT:",
    "TOKEN_GENERATION:",
    "SUPPRESSION_CHECK:",
    "MISSING_TABLE_ALERT:",
    "CONVERSATION_READ:",
    "CONVERSATION_CREATE:",
    "OUTBOUND_CONTEXT:",
  ].some((prefix) => message.includes(prefix))
}
