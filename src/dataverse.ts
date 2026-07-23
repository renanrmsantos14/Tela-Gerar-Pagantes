import { demoOperation } from './demo'
import type { Guid, OperationData, Payer, Person, SubmitRequest, SubmitResult } from './domain'
import { logAppError } from './errorLogger'

interface RetrieveResult { entities: Array<Record<string, unknown>>; nextLink?: string }

interface XrmApi {
  WebApi: {
    retrieveRecord: (entity: string, id: string, options?: string) => Promise<Record<string, unknown>>
    retrieveMultipleRecords: (entity: string, options?: string) => Promise<RetrieveResult>
    createRecord: (entity: string, data: Record<string, unknown>) => Promise<{ id: string }>
    updateRecord: (entity: string, id: string, data: Record<string, unknown>) => Promise<void>
    deleteRecord: (entity: string, id: string) => Promise<void>
  }
}

declare global { interface Window { Xrm?: XrmApi } }

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const linkStatusNotApplicable = 202410000
const linkStatusPending = 202410001
const payerStatusPending = 202410001
const flowUrlEnvironmentVariable = 'new_FlowURLGerarPagantesHttp'
const paymentMethods = new Set([202410000, 202410001, 202410002])
const paidStatuses = new Set(['Pago', 'Autorizado'])

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

export function normalizeGuid(value: string): Guid {
  const clean = value.replace(/[{}]/g, '').trim()
  if (!guidPattern.test(clean)) throw new Error('A OP informada nao possui um GUID valido.')
  return clean
}

export function getRecordIdFromLocation(): Guid | null {
  const search = new URLSearchParams(window.location.search)
  const direct = search.get('recordId')
  const data = search.get('data')
  let candidate = direct
  if (!candidate && data) {
    try { candidate = JSON.parse(decodeURIComponent(data)).recordId as string }
    catch { throw new Error('Os dados recebidos para abrir a OP sao invalidos.') }
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
  const finance = await api.retrieveRecord('cr40f_financeiro', recordId, '?$select=cr40f_idfinanceiro,versionnumber')
  const services = await fetchAll('cr40f_reservadeveculos', `?$select=cr40f_reservadeveculosid,_cr40f_solicitante_value&$filter=_cr40f_financeiro_value eq ${recordId}`)
  const serviceIds = services.map((service) => text(service, 'cr40f_reservadeveculosid')).filter(Boolean)
  if (!serviceIds.length) throw new Error('Esta OP nao possui servicos vinculados.')
  const serviceFilter = serviceIds.map((id) => `_cr40f_servicorelacionadogeral_value eq ${id}`).join(' or ')
  const passengerFilter = serviceIds.map((id) => `_cr40f_geral_value eq ${id}`).join(' or ')
  const [compositions, servicePassengers, existingRows, directoryRows] = await Promise.all([
    fetchAll('cr40f_composicaodeprecos', `?$select=new_valortotal&$filter=${serviceFilter}`),
    fetchAll('cr40f_servicosporpassageiro', `?$select=_cr40f_bancodedados_value&$filter=${passengerFilter}`),
    fetchExistingPayers(recordId),
    fetchAll('cr40f_bancodedados', '?$select=cr40f_bancodedadosid,cr40f_nomedopassageiro,cr40f_email,cr40f_telefone&$orderby=cr40f_nomedopassageiro asc')
  ])
  const totalCents = Math.round(compositions.reduce((sum, row) => sum + Number(row.new_valortotal ?? 0), 0) * 100)
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
    totalCents,
    people,
    directory,
    payers
  }
}

export async function submitOperation(financeiroId: Guid, request: SubmitRequest): Promise<SubmitResult> {
  const api = getXrm()?.WebApi
  const totalCents = request.pagantes.reduce((sum, payer) => sum + payer.amountCents, 0)
  if (!api) return { success: true, requestId: request.requestId, financeiroId, totalCents, results: request.pagantes.map((payer) => ({ paganteId: payer.paganteId, pagantesRecordId: payer.existingPaganteId ?? payer.paganteId, linkStatus: payer.generateLink ? 'Pending' : 'NotApplicable', emailStatus: payer.sendEmail ? 'Pending' : 'NotApplicable' })), errors: [] }
  if (totalCents !== request.totalCents) throw new Error('O total dos pagantes nao fecha com o total da OP.')

  const finance = await api.retrieveRecord('cr40f_financeiro', financeiroId, '?$select=versionnumber')
  if (text(finance, 'versionnumber') !== request.expectedFinanceiroVersion) throw new Error('A OP foi alterada por outro usuario. Atualize a tela e tente novamente.')

  const needsFlow = request.pagantes.some((payer) => payer.generateLink || payer.sendEmail)
  const existingRows = await fetchExistingPayers(financeiroId)
  const existingById = new Map(existingRows.map((row) => [text(row, 'cr40f_pagantesid'), row]))
  const keptIds = new Set(request.pagantes.map((payer) => payer.existingPaganteId).filter((id): id is Guid => Boolean(id)))
  const results: SubmitResult['results'] = []

  await validateBeforeWrite(financeiroId, request, existingRows, existingById)

  for (const row of existingRows) {
    const existingId = text(row, 'cr40f_pagantesid')
    if (existingId && !keptIds.has(existingId)) {
      if (text(row, 'cr40f_cielolinkid')) throw new Error('Nao e permitido remover um pagante que possui link Cielo ativo. Cancele o link antes de alterar o rateio.')
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

    if (existing && changed && text(existing, 'cr40f_cielolinkid')) throw new Error('Nao e permitido alterar um pagante que possui link Cielo ativo. Cancele o link antes de refazer o rateio.')

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
      await startGerarPagantesFlow(flowUrl, financeiroId, request, results)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel acionar o Flow HTTP.'
      await logAppError(error, { source: 'Web Resource', action: 'startGerarPagantesFlow', phase: 'flow-http', component: 'dataverse', detailId: financeiroId, detailType: 'cr40f_financeiro', payload: { requestId: request.requestId } })
      console.error('[GerarPagantes] Pagantes gravados, mas Flow nao foi acionado.', error)
      errors.push({ code: 'FLOW_NOT_STARTED', message })
    }
  }

  return { success: true, requestId: request.requestId, financeiroId, totalCents, results, errors }
}

async function validateBeforeWrite(financeiroId: Guid, request: SubmitRequest, existingRows: Array<Record<string, unknown>>, existingById: Map<string, Record<string, unknown>>): Promise<void> {
  const api = getXrm()?.WebApi
  if (!api) return
  if (!request.pagantes.length) throw new Error('Selecione ao menos um pagante.')
  const payerIds = new Set(request.pagantes.map((payer) => payer.paganteId))
  if (payerIds.size !== request.pagantes.length) throw new Error('Existem pagantes duplicados no rateio.')
  if (request.pagantes.some((payer) => !guidPattern.test(payer.paganteId) || !Number.isInteger(payer.amountCents) || payer.amountCents <= 0 || !paymentMethods.has(payer.paymentMethod))) throw new Error('O rateio possui pagante, valor ou forma de pagamento inválidos.')
  const people = await fetchAll('cr40f_bancodedados', `?$select=cr40f_bancodedadosid,cr40f_status&$filter=${Array.from(payerIds).map((id) => `cr40f_bancodedadosid eq ${id}`).join(' or ')}`)
  const peopleById = new Map(people.map((row) => [text(row, 'cr40f_bancodedadosid'), row]))
  if (peopleById.size !== payerIds.size || people.some((row) => Number(row.cr40f_status) === 202410001)) throw new Error('Um dos pagantes não existe ou está inativo no Dataverse. Atualize a tela.')
  for (const payer of request.pagantes) {
    if (!payer.existingPaganteId) continue
    const existing = existingById.get(payer.existingPaganteId)
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
    'cr40f_financeiro@odata.bind': `/cr40f_financeiros(${financeiroId})`,
    'cr40f_bancodedados@odata.bind': `/cr40f_bancodedadoses(${payer.paganteId})`,
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

async function startGerarPagantesFlow(url: string, financeiroId: Guid, request: SubmitRequest, results: SubmitResult['results']): Promise<void> {
  const body = JSON.stringify({
    requestId: request.requestId,
    financeiroId,
    financeiroDisplayId: request.financeiroDisplayId,
    totalCents: request.totalCents,
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

  const response = await fetch(url, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body })
  const result = await response.json().catch(() => null) as { success?: boolean; message?: string } | null
  if (!response.ok || !result?.success) throw new Error(result?.message || `Flow HTTP retornou ${response.status}.`)
  console.info('[GerarPagantes] Flow HTTP acionado.', { requestId: request.requestId })
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
