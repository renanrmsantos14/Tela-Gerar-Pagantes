type ErrorLogContext = {
  source?: string
  action?: string
  phase?: string
  component?: string
  detailId?: string
  detailType?: string
  errorCode?: string
  payload?: unknown
}

export type OperationLogContext = {
  action: string
  detailId: string
  operatorId?: string
  operatorName?: string
  financeiroVersion?: string
  allocationSummary?: unknown
  payload?: unknown
}

type ErrorLogApi = {
  WebApi?: {
    createRecord: (entity: string, data: Record<string, unknown>) => Promise<{ id: string }>
  }
}

const errorLogTable = 'new_appmotoristaslog'
const appName = 'Tela Gerar Pagantes'
const maxName = 160
const maxMessage = 20000
const maxStack = 100000

function getXrm(): ErrorLogApi | undefined {
  const currentWindow = window as Window & { Xrm?: ErrorLogApi }
  if (currentWindow.Xrm) return currentWindow.Xrm
  try {
    return (window.parent as Window & { Xrm?: ErrorLogApi }).Xrm
  } catch {
    return undefined
  }
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit)
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '{}'
  } catch {
    return '{}'
  }
}

function normalizeError(error: unknown): { name: string; message: string; stack: string } {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Erro sem mensagem.',
      stack: error.stack || error.toString()
    }
  }

  const message = typeof error === 'string' ? error : stringify(error)
  return { name: 'UnknownError', message, stack: message }
}

export async function logAppError(error: unknown, context: ErrorLogContext = {}): Promise<void> {
  const api = getXrm()?.WebApi
  if (!api) return

  const normalized = normalizeError(error)
  const action = context.action || 'runtime-error'
  const rawJson = stringify({
    name: normalized.name,
    message: normalized.message,
    stack: normalized.stack,
    errorCode: context.errorCode || ''
  })

  const record: Record<string, unknown> = {
    new_name: truncate(`${appName} - ${action}`, maxName),
    new_occurredat: new Date().toISOString(),
    new_severity: 'error',
    new_source: context.source || 'Web Resource',
    new_action: truncate(action, 180),
    new_phase: context.phase || 'runtime',
    new_component: context.component || appName,
    new_detailid: context.detailId || '',
    new_detailtype: context.detailType || '',
    new_message: truncate(normalized.message, maxMessage),
    new_stack: truncate(normalized.stack, maxStack),
    new_errorname: truncate(normalized.name, 220),
    new_errorcode: truncate(context.errorCode || '', 120),
    new_appname: appName,
    new_payloadjson: truncate(stringify(context.payload ?? {}), maxStack),
    new_rawjson: truncate(rawJson, maxStack)
  }

  try {
    await api.createRecord(errorLogTable, record)
  } catch (loggingError) {
    console.error('[GerarPagantes] Falha ao gravar erro na tabela de logs.', loggingError)
  }
}

export async function logAppOperation(context: OperationLogContext): Promise<void> {
  const api = getXrm()?.WebApi
  if (!api) return
  const payload = {
    operatorId: context.operatorId || '',
    operatorName: context.operatorName || '',
    financeiroVersion: context.financeiroVersion || '',
    allocationSummary: context.allocationSummary ?? {},
    payload: context.payload ?? {}
  }
  try {
    await api.createRecord(errorLogTable, {
      new_name: truncate(`${appName} - ${context.action}`, maxName),
      new_occurredat: new Date().toISOString(),
      new_severity: 'info',
      new_source: 'Web Resource',
      new_action: truncate(context.action, 180),
      new_phase: 'operation',
      new_component: 'dataverse',
      new_detailid: context.detailId,
      new_detailtype: 'cr40f_financeiro',
      new_message: 'Geração de pagantes registrada.',
      new_stack: '',
      new_errorname: '',
      new_errorcode: '',
      new_appname: appName,
      new_payloadjson: truncate(stringify(payload), maxStack),
      new_rawjson: truncate(stringify({ occurredAt: new Date().toISOString(), ...payload }), maxStack)
    })
  } catch (error) {
    console.error('[GerarPagantes] Falha ao gravar log operacional.', error)
  }
}

export function installGlobalErrorLogging(): () => void {
  const onError = (event: ErrorEvent) => {
    void logAppError(event.error || event.message, {
      source: 'Window',
      action: 'window.error',
      phase: 'global',
      component: 'window',
      payload: { filename: event.filename, lineno: event.lineno, colno: event.colno }
    })
  }
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    void logAppError(event.reason, {
      source: 'Window',
      action: 'unhandledrejection',
      phase: 'global',
      component: 'window'
    })
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }
}
