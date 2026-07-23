import { demoOperation } from './demo'
import type { FlowPayerResult, Guid, OperationData, Payer, Person, SubmitRequest, SubmitResult } from './domain'
import { logAppError, logAppOperation } from './errorLogger'

interface RetrieveResult { entities: Array<Record<string, unknown>>; nextLink?: string }

interface XrmApi {
  WebApi: {
    retrieveRecord: (entity: string, id: string, options?: string) => Promise<Record<string, unknown>>
    retrieveMultipleRecords: (entity: string, options?: string) => Promise<RetrieveResult>
    createRecord: (entity: string, data: Record<string, unknown>) => Promise<{ id: string }>
    updateRecord: (entity: string, id: string, data: Record<string, unknown>) => Promise<void>
    deleteRecord: (entity: string, id: string) => Promise<void>
    online?: { execute: (request: Record<string, unknown>) => Promise<{ ok?: boolean; json: () => Promise<Record<string, unknown>> }> }
  }
  Utility?: { getGlobalContext?: () => { userSettings?: { userId?: string; userName?: string } } }
}

declare global { interface Window { Xrm?: XrmApi } }

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const linkStatusNotApplicable = 202410000
const linkStatusPending = 202410001
const payerStatusPending = 202410001
const flowUrlEnvironmentVariable = 'new_FlowURLGerarPagantesHttp'
const paymentMethods = new Set([202410000, 202410001, 202410002])
const paidStatuses = new Set(['Pago', 'Autorizado'])
const generationTable = 'cr40f_geracaopagantesoperacao'
const activeGenerationWindowMs = 15 * 60 * 1000

function toLinkStatus(value: string): Payer['linkStatus'] {
  if (value === 'Pendente') return 'Pending'
  if (value === 'Concluido') return 'Generated'
  if (value === 'Erro') return 'Failed'
  return 'NotApplicable'
}

function toEmailStatus(value: string): Payer['emailStatus'] {
  if (value === 'Pendente') return 'Pending'
  if (value === 'Concluido') return 'Sent'
  if (value === 'Erro') return 'Failed'
  return 'NotApplicable'
}

function getXrm(): XrmApi | undefined {
  if (window.Xrm) return window.Xrm
  try { return window.parent !== window ? window.parent.Xrm : undefined }
  catch { return undefined }
}

function normalizeComparable(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}

function currentOperator(): { id: string; name: string } {
  const settings = getXrm()?.Utility?.getGlobalContext?.().userSettings
  return { id: String(settings?.userId ?? '').replace(/[{}]/g, ''), name: String(settings?.userName ?? '') }
}

function assertOperationEditable(finance: Record<string, unknown>): void {
  const stateCode = Number(finance.statecode ?? 0)
  const statusLabel = text(finance, 'statuscode@OData.Community.Display.V1.FormattedValue')
  if (stateCode === 1 || /cancel|encerr|fechad/i.test(statusLabel)) {
    throw new Error(`A OP está ${statusLabel || 'inativa'} e não pode gerar pagantes.`)
  }
}

async function fetchOperationTotal(financeiroId: Guid): Promise<number> {
  const services = await fetchAll('cr40f_reservadeveculos', `?$select=cr40f_reservadeveculosid&$filter=_cr40f_financeiro_value eq ${financeiroId}`)
  const serviceIds = services.map((service) => text(service, 'cr40f_reservadeveculosid')).filter(Boolean)
  if (!serviceIds.length) throw new Error('Esta OP não possui serviços vinculados.')
  const serviceFilter = serviceIds.map((id) => `_cr40f_servicorelacionadogeral_value eq ${id}`).join(' or ')
  const compositions = await fetchAll('cr40f_composicaodeprecos', `?$select=new_valortotal&$filter=${serviceFilter}`)
  const totalCents = Math.round(compositions.reduce((sum, row) => sum + Number(row.new_valortotal ?? 0), 0) * 100)
  if (totalCents <= 0) throw new Error('A OP não possui composição de preço válida.')
  return totalCents
}

export function normalizeGuid(value: string): Guid {
  const clean = value.replace(/[{}]/g, '').trim()
  if (!guidPattern.test(clean)) throw new Error('A OP informada não possui um GUID válido.')
  return clean
}

export function getRecordIdFromLocation(): Guid | null {
  const search = new URLSearchParams(window.location.search)
  const direct = search.get('recordId')
  const data = search.get('data')
  let candidate = direct
  if (!candidate && data) {
    try { candidate = JSON.parse(decodeURIComponent(data)).recordId as string }
    catch { throw new Error('Os dados recebidos para abrir a OP são inválidos.') }
  }
  return candidate ? normalizeGuid(candidate) : null
}

async function fetchAll(entity: string, options: string): Promise<Array<Record<string, unknown>>> {
  const api = getXrm()?.WebApi
  if (!api) return []
  const all: Array<Record<string, unknown>> = []
  let page: RetrieveResult | undefined = await api.retrieveMultipleRecords(entity, options)
  while (page) {
    all.push(...page.entities)
    page = page.nextLink ? await api.retrieveMultipleRecords(entity, page.nextLink) : undefined
  }
  return all
}

const text = (row: Record<string, unknown>, field: string) => String(row[field] ?? '')
const lookup = (row: Record<string, unknown>, field: string) => row[field] ? String(row[field]) : undefined
const moneyToCents = (value: unknown) => Math.round(Number(value ?? 0) * 100)

function toBrazilDateOnly(value: unknown): string | null {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function toPerson(row: Record<string, unknown>, role: Person['role']): Person {
  return {
    id: text(row, 'cr40f_bancodedadosid'),
    name: text(row, 'cr40f_nomedopassageiro'),
    email: text(row, 'cr40f_email'),
    phone: text(row, 'cr40f_telefone'),
    role
  }
}

function toPayer(row: Record<string, unknown>, people: Map<Guid, Person>): Payer | null {
  const personId = lookup(row, '_cr40f_bancodedados_value')
  const person = personId ? people.get(personId) : undefined
  if (!person) return null
  const emailStatusValue = text(row, 'cr40f_statusenvioemail')
  return {
    ...person,
    existingPayerId: text(row, 'cr40f_pagantesid'),
    paymentStatus: text(row, 'cr40f_status@OData.Community.Display.V1.FormattedValue'),
    amountCents: moneyToCents(row.cr40f_valor),
    paymentMethod: Number(row.cr40f_formadepagamento ?? 202410000) as Payer['paymentMethod'],
    generateLink: Boolean(text(row, 'cr40f_linkdepagamento')),
    sendEmail: emailStatusValue ? emailStatusValue !== '202410000' : false,
    paymentUrl: text(row, 'cr40f_linkdepagamento') || undefined,
    linkStatus: toLinkStatus(text(row, 'cr40f_statusgeracaolink@OData.Community.Display.V1.FormattedValue')),
    emailStatus: toEmailStatus(text(row, 'cr40f_statusenvioemail@OData.Community.Display.V1.FormattedValue')),
    linkError: text(row, 'cr40f_errogeracaolink') || undefined,
    emailError: text(row, 'cr40f_erroenvioemail') || undefined
  }
}

async function fetchExistingPayers(recordId: Guid): Promise<Array<Record<string, unknown>>> {
  const baseSelect = 'cr40f_pagantesid,_cr40f_financeiro_value,_cr40f_bancodedados_value,cr40f_valor,cr40f_formadepagamento,cr40f_status,cr40f_statusgeracaolink,cr40f_statusenvioemail,cr40f_errogeracaolink,cr40f_erroenvioemail,cr40f_linkdepagamento,cr40f_cielolinkid,cr40f_cieloordernumber'
  const filter = `$filter=_cr40f_financeiro_value eq ${recordId}`
  return fetchAll('cr40f_pagantes', `?$select=${baseSelect}&${filter}`)
}

export async function loadOperation(recordId: Guid): Promise<OperationData> {
  const xrm = getXrm()
  if (!xrm?.WebApi) return demoOperation
  const api = xrm.WebApi
  const finance = await api.retrieveRecord('cr40f_financeiro', recordId, '?$select=cr40f_idfinanceiro,versionnumber,statecode,statuscode,_ownerid_value')
  assertOperationEditable(finance)
  const services = await fetchAll('cr40f_reservadeveculos', `?$select=cr40f_reservadeveculosid,cr40f_dataehorriodesada,_cr40f_solicitante_value&$filter=_cr40f_financeiro_value eq ${recordId}`)
  const serviceIds = services.map((service) => text(service, 'cr40f_reservadeveculosid')).filter(Boolean)
  if (!serviceIds.length) throw new Error('Esta OP não possui serviços vinculados.')
  const serviceFilter = serviceIds.map((id) => `_cr40f_servicorelacionadogeral_value eq ${id}`).join(' or ')
  const passengerFilter = serviceIds.map((id) => `_cr40f_geral_value eq ${id}`).join(' or ')
  const [compositions, servicePassengers, existingRows, directoryRows] = await Promise.all([
    fetchAll('cr40f_composicaodeprecos', `?$select=new_valortotal&$filter=${serviceFilter}`),
    fetchAll('cr40f_servicosporpassageiro', `?$select=_cr40f_bancodedados_value&$filter=${passengerFilter}`),
    fetchExistingPayers(recordId),
    fetchAll('cr40f_bancodedados', '?$select=cr40f_bancodedadosid,cr40f_nomedopassageiro,cr40f_email,cr40f_telefone&$orderby=cr40f_nomedopassageiro asc')
  ])
  const totalCents = Math.round(compositions.reduce((sum, row) => sum + Number(row.new_valortotal ?? 0), 0) * 100)
  const serviceDates = services.map((service) => ({ timestamp: Date.parse(text(service, 'cr40f_dataehorriodesada')), date: toBrazilDateOnly(service.cr40f_dataehorriodesada) })).filter((service): service is { timestamp: number; date: string } => Boolean(service.date) && !Number.isNaN(service.timestamp)).sort((left, right) => left.timestamp - right.timestamp)
  const requesterIds = services.map((service) => lookup(service, '_cr40f_solicitante_value')).filter((id): id is string => Boolean(id))
  const passengerIds = servicePassengers.map((row) => lookup(row, '_cr40f_bancodedados_value')).filter((id): id is string => Boolean(id))
  const involvedIds = new Set([...requesterIds, ...passengerIds])
  const requesterSet = new Set(requesterIds)
  const directory = directoryRows.map((row) => toPerson(row, requesterSet.has(text(row, 'cr40f_bancodedadosid')) ? 'Solicitante' : involvedIds.has(text(row, 'cr40f_bancodedadosid')) ? 'Passageiro' : 'Adicionado'))
  const people = directory.filter((person) => involvedIds.has(person.id))
  const personMap = new Map(directory.map((person) => [person.id, person]))
  const payers = existingRows.map((row) => toPayer(row, personMap)).filter((payer): payer is Payer => Boolean(payer))
  return {
    id: recordId,
    displayId: text(finance, 'cr40f_idfinanceiro') || recordId,
    version: text(finance, 'versionnumber'),
    serviceCount: services.length,
    serviceStartDate: serviceDates[0]?.date ?? null,
    serviceEndDate: serviceDates.at(-1)?.date ?? null,
    totalCents,
    statusLabel: text(finance, 'statuscode@OData.Community.Display.V1.FormattedValue'),
    stateCode: Number(finance.statecode ?? 0),
    ownerId: lookup(finance, '_ownerid_value'),
    people,
    directory,
    payers
  }
}

function isMissingGenerationTableError(error: unknown): boolean {
  let serialized: string
  try { serialized = error instanceof Error ? `${error.message} ${JSON.stringify(error)}` : JSON.stringify(error) }
  catch { serialized = String(error) }
  return serialized.includes(generationTable) && /metadata does not exist|n[aã]o [ée] poss[ií]vel localizar a entidade|entidade inv[aá]lida/i.test(serialized)
}

async function beginGenerationLock(financeiroId: Guid, request: SubmitRequest): Promise<Guid | null> {
  const api = getXrm()?.WebApi
  if (!api) return request.requestId
  try {
    const recent = await fetchAll(generationTable, `?$select=cr40f_geracaopagantesoperacaoid,cr40f_request_id,cr40f_sucesso,cr40f_resultado,createdon&$filter=_cr40f_financeiro_value eq ${financeiroId} and cr40f_sucesso eq false&$orderby=createdon desc&$top=1`)
    const latest = recent[0]
    if (latest) {
      const createdAt = Date.parse(text(latest, 'createdon'))
      const processing = (() => { try { return JSON.parse(text(latest, 'cr40f_resultado')).status === 'Processing' } catch { return false } })()
      if (processing && (!createdAt || Date.now() - createdAt < activeGenerationWindowMs)) {
        throw new Error('Já existe outra geração de pagantes em processamento nesta OP.')
      }
    }
    const operator = currentOperator()
    const created = await api.createRecord(generationTable, {
      cr40f_name: `Geração ${request.financeiroDisplayId} - ${request.requestId}`,
      cr40f_request_id: request.requestId,
      'cr40f_Financeiro@odata.bind': `/cr40f_financeiros(${financeiroId})`,
      cr40f_sucesso: false,
      cr40f_resultado: JSON.stringify({ status: 'Processing', operatorId: operator.id, operatorName: operator.name, financeiroVersion: request.expectedFinanceiroVersion, allocationSummary: { totalCents: request.totalCents, allocatedCents: request.pagantes.reduce((sum, payer) => sum + payer.amountCents, 0), payerCount: request.pagantes.length } })
    })
    return normalizeGuid(created.id)
  } catch (error) {
    if (!isMissingGenerationTableError(error)) throw error
    console.warn(`[GerarPagantes] Tabela opcional ${generationTable} ausente; geração seguirá sem lock.`, error)
    return null
  }
}

async function finishGenerationLock(lockId: Guid | null, request: SubmitRequest, result: SubmitResult): Promise<void> {
  const api = getXrm()?.WebApi
  if (!api || !lockId) return
  await api.updateRecord(generationTable, lockId, {
    cr40f_sucesso: result.success,
    cr40f_resultado: JSON.stringify({ status: result.success ? 'Completed' : 'Failed', requestId: request.requestId, results: result.results, errors: result.errors })
  })
}

export async function submitOperation(financeiroId: Guid, request: SubmitRequest): Promise<SubmitResult> {
  const api = getXrm()?.WebApi
  const totalCents = request.pagantes.reduce((sum, payer) => sum + payer.amountCents, 0)
  if (!api) return { success: true, requestId: request.requestId, financeiroId, totalCents, results: request.pagantes.map((payer) => ({ paganteId: payer.paganteId, pagantesRecordId: payer.existingPaganteId ?? payer.paganteId, linkStatus: payer.generateLink ? 'Pending' : 'NotApplicable', emailStatus: payer.sendEmail ? 'Pending' : 'NotApplicable' })), errors: [] }
  if (totalCents !== request.totalCents && !request.allowTotalMismatch) throw new Error('O total dos pagantes não fecha com o total da OP.')

  const finance = await api.retrieveRecord('cr40f_financeiro', financeiroId, '?$select=versionnumber,statecode,statuscode,_ownerid_value')
  assertOperationEditable(finance)
  if (text(finance, 'versionnumber') !== request.expectedFinanceiroVersion) throw new Error('A OP foi alterada por outro usuário. Atualize a tela e tente novamente.')
  const freshTotalCents = await fetchOperationTotal(financeiroId)
  if (freshTotalCents !== request.totalCents) throw new Error('O valor da OP mudou. Atualize os dados antes de salvar.')

  if (request.replaceExisting) {
    const api = getXrm()?.WebApi.online
    if (!api?.execute) throw new Error('A substituição segura não está publicada no ambiente. Nenhum pagante foi apagado.')
    const customApiRequest = {
      Target: { entityType: 'cr40f_financeiro', id: financeiroId },
      cr40f_RequestJson: JSON.stringify({ ...request, replaceExisting: true, pagantes: request.pagantes.map((payer) => ({ ...payer, existingPaganteId: undefined, generateLink: false, sendEmail: false })) }),
      getMetadata: () => ({ boundParameter: null, parameterTypes: { Target: { typeName: 'Microsoft.Dynamics.CRM.cr40f_financeiro', structuralProperty: 5 }, cr40f_RequestJson: { typeName: 'Edm.String', structuralProperty: 1 } }, operationType: 0, operationName: 'cr40f_GerarPagantes' })
    }
    const response = await api.execute(customApiRequest)
    if (response.ok === false) throw new Error('A Cielo não confirmou o cancelamento dos links existentes. Nenhum pagante foi apagado.')
    const body = await response.json()
    const raw = String(body.cr40f_ResponseJson ?? '')
    const customResult = raw ? JSON.parse(raw) as SubmitResult : null
    if (!customResult?.success || !Array.isArray(customResult.results)) throw new Error('A substituição não foi confirmada pelo servidor. Nenhum pagante foi apagado.')
    if (!request.pagantes.some((payer) => payer.generateLink || payer.sendEmail)) return customResult
    const flowUrl = await resolveFlowUrl()
    const flowResults = await startGerarPagantesFlow(flowUrl, financeiroId, request, customResult.results)
    const byPayer = new Map(flowResults.map((item) => [item.paganteId, item]))
    customResult.results.forEach((result) => Object.assign(result, byPayer.get(result.paganteId)))
    customResult.success = customResult.errors.length === 0 && flowResults.every((item) => !item.error)
    return customResult
  }

  const needsFlow = request.pagantes.some((payer) => payer.generateLink || payer.sendEmail)
  const existingRows = await fetchExistingPayers(financeiroId)
  const existingById = new Map(existingRows.map((row) => [text(row, 'cr40f_pagantesid'), row]))
  const keptIds = new Set(request.pagantes.map((payer) => payer.existingPaganteId).filter((id): id is Guid => Boolean(id)))
  const results: SubmitResult['results'] = []

  await validateBeforeWrite(financeiroId, request, existingRows, existingById)
  const lockId = await beginGenerationLock(financeiroId, request)
  let finalResult: SubmitResult

  try {
    for (const row of existingRows) {
      const existingId = text(row, 'cr40f_pagantesid')
      if (existingId && !keptIds.has(existingId)) {
        if (text(row, 'cr40f_cielolinkid')) throw new Error('Não é permitido remover um pagante que possui link Cielo ativo. Cancele o link antes de alterar o rateio.')
        await api.deleteRecord('cr40f_pagantes', existingId)
      }
    }

    for (const payer of request.pagantes) {
      const existing = payer.existingPaganteId ? existingById.get(payer.existingPaganteId) : undefined
      const changed = !existing
        || lookup(existing, '_cr40f_bancodedados_value') !== payer.paganteId
        || moneyToCents(existing.cr40f_valor) !== payer.amountCents
        || Number(existing.cr40f_formadepagamento ?? 202410000) !== payer.paymentMethod
        || !payer.generateLink

      if (existing && changed && text(existing, 'cr40f_cielolinkid')) throw new Error('Não é permitido alterar um pagante que possui link Cielo ativo. Cancele o link antes de refazer o rateio.')

      const payload = buildPayerRecord(financeiroId, payer, changed)
      let pagantesRecordId = payer.existingPaganteId
      if (pagantesRecordId) await api.updateRecord('cr40f_pagantes', pagantesRecordId, payload)
      else {
        const created = await api.createRecord('cr40f_pagantes', payload)
        pagantesRecordId = normalizeGuid(created.id)
      }

      results.push({ paganteId: payer.paganteId, pagantesRecordId, linkStatus: payer.generateLink ? 'Pending' : 'NotApplicable', emailStatus: payer.sendEmail ? 'Pending' : 'NotApplicable' })
    }

    const errors: SubmitResult['errors'] = []
    if (needsFlow) {
      try {
        const flowUrl = await resolveFlowUrl()
        const flowResults = await startGerarPagantesFlow(flowUrl, financeiroId, request, results)
        const byPayer = new Map(flowResults.map((item) => [item.paganteId, item]))
        for (const result of results) {
          const flowResult = byPayer.get(result.paganteId)
          if (!flowResult || flowResult.paganteRecordId !== result.pagantesRecordId) throw new Error(`O Flow não confirmou o pagante ${result.paganteId}.`)
          Object.assign(result, flowResult)
          if (flowResult.error) errors.push({ code: 'FLOW_PAYER_ERROR', message: flowResult.error, paganteId: result.paganteId })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível acionar o Flow HTTP.'
        await logAppError(error, { source: 'Web Resource', action: 'startGerarPagantesFlow', phase: 'flow-http', component: 'dataverse', detailId: financeiroId, detailType: 'cr40f_financeiro', payload: { requestId: request.requestId } })
        console.error('[GerarPagantes] Pagantes gravados, mas o Flow não foi acionado.', error)
        errors.push({ code: 'FLOW_NOT_STARTED', message })
      }
    }

    finalResult = { success: errors.length === 0, requestId: request.requestId, financeiroId, totalCents, results, errors }
    await finishGenerationLock(lockId, request, finalResult)
    const operator = currentOperator()
    await logAppOperation({ action: 'gerar-pagantes', detailId: financeiroId, operatorId: operator.id, operatorName: operator.name, financeiroVersion: request.expectedFinanceiroVersion, allocationSummary: { totalCents: request.totalCents, allocatedCents: totalCents, payerCount: request.pagantes.length }, payload: { requestId: request.requestId, results, errors } })
    return finalResult
  } catch (error) {
    finalResult = { success: false, requestId: request.requestId, financeiroId, totalCents, results, errors: [{ code: 'SAVE_FAILED', message: error instanceof Error ? error.message : 'Falha ao gravar pagantes.' }] }
    try { await finishGenerationLock(lockId, request, finalResult) } catch { /* preserve original error */ }
    throw error
  }
}

async function validateBeforeWrite(financeiroId: Guid, request: SubmitRequest, existingRows: Array<Record<string, unknown>>, existingById: Map<string, Record<string, unknown>>): Promise<void> {
  const api = getXrm()?.WebApi
  if (!api) return
  if (!request.pagantes.length) throw new Error('Selecione ao menos um pagante.')
  const payerIds = new Set(request.pagantes.map((payer) => payer.paganteId))
  if (payerIds.size !== request.pagantes.length) throw new Error('Existem pagantes duplicados no rateio.')
  if (request.pagantes.some((payer) => !guidPattern.test(payer.paganteId) || !Number.isInteger(payer.amountCents) || payer.amountCents <= 0 || !paymentMethods.has(payer.paymentMethod))) throw new Error('O rateio possui pagante, valor ou forma de pagamento inválidos.')
  if (request.pagantes.some((payer) => payer.sendEmail && (!payer.generateLink || !/^\S+@\S+\.\S+$/.test(payer.email.trim())))) throw new Error('Envio de e-mail exige link e e-mail válido para cada pagante.')
  const people = await fetchAll('cr40f_bancodedados', `?$select=cr40f_bancodedadosid,cr40f_nomedopassageiro,cr40f_email,cr40f_status&$filter=${Array.from(payerIds).map((id) => `cr40f_bancodedadosid eq ${id}`).join(' or ')}`)
  const peopleById = new Map(people.map((row) => [text(row, 'cr40f_bancodedadosid'), row]))
  if (peopleById.size !== payerIds.size || people.some((row) => Number(row.cr40f_status) === 202410001)) throw new Error('Um dos pagantes não existe ou está inativo no Dataverse. Atualize a tela.')
  for (const payer of request.pagantes) {
    const person = peopleById.get(payer.paganteId)
    if (!person || normalizeComparable(person.cr40f_nomedopassageiro) !== normalizeComparable(payer.name) || normalizeComparable(person.cr40f_email) !== normalizeComparable(payer.email)) throw new Error(`Os dados do pagante ${payer.paganteId} divergem do Dataverse. Atualize a tela.`)
    if (!payer.existingPaganteId) continue
    const existing = existingById.get(payer.existingPaganteId)
    if (existing && lookup(existing, '_cr40f_bancodedados_value') !== payer.paganteId) throw new Error('O registro de pagante não corresponde à pessoa selecionada. Atualize a tela.')
    if (!existing || lookup(existing, '_cr40f_financeiro_value') && lookup(existing, '_cr40f_financeiro_value') !== financeiroId) throw new Error('Um registro de pagante não pertence a esta OP. Atualize a tela.')
    const status = text(existing, 'cr40f_status@OData.Community.Display.V1.FormattedValue')
    if (paidStatuses.has(status)) throw new Error(`O pagante ${payer.name} já está ${status} e não pode ser alterado.`)
  }
  for (const row of existingRows) {
    if (keptIdsFor(request).has(text(row, 'cr40f_pagantesid'))) continue
    const status = text(row, 'cr40f_status@OData.Community.Display.V1.FormattedValue')
    if (paidStatuses.has(status)) throw new Error(`O pagante ${status} não pode ser removido do rateio.`)
    if (text(row, 'cr40f_cielolinkid')) throw new Error('O rateio não pode remover pagante com link Cielo ativo.')
  }
}

function keptIdsFor(request: SubmitRequest): Set<string> { return new Set(request.pagantes.map((payer) => payer.existingPaganteId).filter((id): id is string => Boolean(id))) }

function buildPayerRecord(financeiroId: Guid, payer: SubmitRequest['pagantes'][number], resetLink: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    'cr40f_Financeiro@odata.bind': `/cr40f_financeiros(${financeiroId})`,
    'cr40f_BancodeDados@odata.bind': `/cr40f_bancodedadoses(${payer.paganteId})`,
    cr40f_valor: payer.amountCents / 100,
    cr40f_formadepagamento: payer.paymentMethod,
    cr40f_status: payerStatusPending,
    cr40f_statusgeracaolink: payer.generateLink ? linkStatusPending : linkStatusNotApplicable,
    cr40f_statusenvioemail: payer.sendEmail ? linkStatusPending : linkStatusNotApplicable,
    cr40f_errogeracaolink: null,
    cr40f_erroenvioemail: null
  }

  if (resetLink || !payer.generateLink) {
    payload.cr40f_cielolinkid = null
    payload.cr40f_cieloordernumber = null
    payload.cr40f_linkdepagamento = null
  }

  return payload
}

async function startGerarPagantesFlow(url: string, financeiroId: Guid, request: SubmitRequest, results: SubmitResult['results']): Promise<FlowPayerResult[]> {
  const operator = currentOperator()
  const body = JSON.stringify({
    requestId: request.requestId,
    financeiroId,
    financeiroDisplayId: request.financeiroDisplayId,
    operatorId: operator.id,
    operatorName: operator.name,
    financeiroVersion: request.expectedFinanceiroVersion,
    totalCents: request.totalCents,
    allocationSummary: { allocatedCents: request.pagantes.reduce((sum, payer) => sum + payer.amountCents, 0), payerCount: request.pagantes.length },
    serviceStartDate: request.serviceStartDate ?? null,
    serviceEndDate: request.serviceEndDate ?? null,
    pagantes: request.pagantes.map((payer) => ({
      paganteRecordId: results.find((result) => result.paganteId === payer.paganteId)?.pagantesRecordId,
      paganteId: payer.paganteId,
      name: payer.name,
      email: payer.email,
      amountCents: payer.amountCents,
      paymentMethod: payer.paymentMethod,
      generateLink: payer.generateLink,
      sendEmail: payer.sendEmail
    }))
  })

  type FlowHttpResponse = { success?: boolean; requestId?: string; message?: string; results?: FlowPayerResult[]; errors?: Array<{ paganteId?: Guid; message?: string }> }
  let response: Response | undefined
  let result: FlowHttpResponse | null = null
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      response = await fetch(url, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body, signal: controller.signal })
      const responseText = await response.text()
      try {
        result = responseText ? JSON.parse(responseText) as FlowHttpResponse : null
      } catch {
        result = null
      }
      if (response.ok && result?.success) break
      const responseDetail = result?.message || responseText.trim().slice(0, 1000) || response.statusText
      lastError = new Error(`Flow HTTP retornou ${response.status}${responseDetail ? `: ${responseDetail}` : '.'}`)
      console.error('[GerarPagantes] Falha HTTP ao acionar Flow.', {
        attempt: attempt + 1,
        requestId: request.requestId,
        status: response.status,
        statusText: response.statusText,
        response: responseText.slice(0, 1000)
      })
      if (response.status < 500 && response.status !== 408 && response.status !== 429) break
    } catch (error) {
      lastError = error instanceof DOMException && error.name === 'AbortError'
        ? new Error('Flow HTTP excedeu o limite de 15 segundos.')
        : error
      console.error('[GerarPagantes] Erro de rede ao acionar Flow.', {
        attempt: attempt + 1,
        requestId: request.requestId,
        error: lastError
      })
    } finally {
      window.clearTimeout(timeout)
    }
    if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)))
  }
  if (!response?.ok || !result?.success) throw lastError instanceof Error ? lastError : new Error(result?.message || 'Não foi possível concluir o Flow HTTP.')
  if (result.requestId !== request.requestId || !Array.isArray(result.results)) throw new Error('O Flow retornou uma confirmação inválida para esta geração.')
  const expectedIds = new Set(results.map((item) => item.paganteId))
  const validStatuses = new Set(['NotApplicable', 'Generated', 'Pending', 'Failed', 'Indeterminate'])
  const validEmailStatuses = new Set(['NotApplicable', 'Sent', 'Pending', 'Failed'])
  if (result.results.length !== expectedIds.size || result.results.some((item) => !expectedIds.has(item.paganteId) || !validStatuses.has(item.linkStatus) || !validEmailStatuses.has(item.emailStatus) || !guidPattern.test(item.paganteRecordId))) throw new Error('O Flow não confirmou todos os pagantes individualmente.')
  console.info('[GerarPagantes] Flow HTTP confirmado por pagante.', { requestId: request.requestId, count: result.results.length })
  return result.results
}

async function resolveFlowUrl(): Promise<string> {
  const rows = await fetchAll('environmentvariabledefinition', `?$select=schemaname,defaultvalue&$filter=schemaname eq '${flowUrlEnvironmentVariable}'&$expand=environmentvariabledefinition_environmentvariablevalue($select=value)`)
  const definition = rows[0]
  const values = definition?.environmentvariabledefinition_environmentvariablevalue
  const current = Array.isArray(values) ? text(values[0] as Record<string, unknown>, 'value') : ''
  const url = current || (definition ? text(definition, 'defaultvalue') : '')
  if (!url) throw new Error(`Configure a variavel de ambiente ${flowUrlEnvironmentVariable} com a URL do Flow HTTP.`)
  return url
}
