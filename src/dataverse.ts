import { demoOperation } from './demo'
import type { Guid, OperationData, Payer, Person, SubmitRequest, SubmitResult } from './domain'

interface RetrieveResult { entities: Array<Record<string, unknown>>; nextLink?: string }

interface XrmApi {
  WebApi: {
    retrieveRecord: (entity: string, id: string, options?: string) => Promise<Record<string, unknown>>
    retrieveMultipleRecords: (entity: string, options?: string) => Promise<RetrieveResult>
    online: { execute: (request: Record<string, unknown>) => Promise<Response> }
  }
}

declare global { interface Window { Xrm?: XrmApi } }

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getXrm(): XrmApi | undefined {
  if (window.Xrm) return window.Xrm
  try { return window.parent !== window ? window.parent.Xrm : undefined }
  catch { return undefined }
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
  return {
    ...person,
    existingPayerId: text(row, 'cr40f_pagantesid'),
    paymentStatus: text(row, 'cr40f_status@OData.Community.Display.V1.FormattedValue'),
    amountCents: Math.round(Number(row.cr40f_valor ?? 0) * 100),
    paymentMethod: Number(row.cr40f_formadepagamento ?? 202410000) as Payer['paymentMethod'],
    generateLink: Boolean(text(row, 'cr40f_linkdepagamento')),
    sendEmail: text(row, 'cr40f_statusenvioemail') !== '202410000',
    paymentUrl: text(row, 'cr40f_linkdepagamento') || undefined,
    linkStatus: (text(row, 'cr40f_statusgeracaolink@OData.Community.Display.V1.FormattedValue') || 'NotApplicable') as Payer['linkStatus'],
    emailStatus: (text(row, 'cr40f_statusenvioemail@OData.Community.Display.V1.FormattedValue') || 'NotApplicable') as Payer['emailStatus']
  }
}

export async function loadOperation(recordId: Guid): Promise<OperationData> {
  const xrm = getXrm()
  if (!xrm?.WebApi) return demoOperation
  const api = xrm.WebApi
  const finance = await api.retrieveRecord('cr40f_financeiro', recordId, '?$select=cr40f_idfinanceiro,versionnumber')
  const services = await fetchAll('cr40f_reservadeveculos', `?$select=cr40f_reservadeveculosid,_cr40f_solicitante_value&$filter=_cr40f_financeiro_value eq ${recordId}`)
  const serviceIds = services.map((service) => text(service, 'cr40f_reservadeveculosid')).filter(Boolean)
  if (!serviceIds.length) throw new Error('Esta OP não possui serviços vinculados.')
  const serviceFilter = serviceIds.map((id) => `_cr40f_servicorelacionadogeral_value eq ${id}`).join(' or ')
  const passengerFilter = serviceIds.map((id) => `_cr40f_geral_value eq ${id}`).join(' or ')
  const [compositions, servicePassengers, existingRows, directoryRows] = await Promise.all([
    fetchAll('cr40f_composicaodeprecos', `?$select=new_valortotal&$filter=${serviceFilter}`),
    fetchAll('cr40f_servicosporpassageiro', `?$select=_cr40f_bancodedados_value&$filter=${passengerFilter}`),
    fetchAll('cr40f_pagantes', `?$select=cr40f_pagantesid,_cr40f_bancodedados_value,cr40f_valor,cr40f_formadepagamento,cr40f_status,cr40f_linkdepagamento,cr40f_statusgeracaolink,cr40f_statusenvioemail&$filter=_cr40f_financeiro_value eq ${recordId}`),
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
  if (!api) return { success: true, requestId: request.requestId, financeiroId, totalCents: request.pagantes.reduce((sum, payer) => sum + payer.amountCents, 0), results: request.pagantes.map((payer) => ({ paganteId: payer.paganteId, pagantesRecordId: payer.existingPaganteId ?? payer.paganteId, linkStatus: payer.generateLink ? 'Generated' : 'NotApplicable', emailStatus: payer.sendEmail ? 'Pending' : 'NotApplicable' })), errors: [] }
  const action = {
    entity: { entityType: 'cr40f_financeiro', id: financeiroId },
    cr40f_RequestJson: JSON.stringify(request),
    getMetadata: () => ({ boundParameter: 'entity', parameterTypes: { entity: { typeName: 'mscrm.cr40f_financeiro', structuralProperty: 5 }, cr40f_RequestJson: { typeName: 'Edm.String', structuralProperty: 1 } }, operationName: 'cr40f_GerarPagantes', operationType: 0 })
  }
  const response = await api.online.execute(action)
  if (!response.ok) throw new Error(`Não foi possível salvar o rateio (${response.status}).`)
  const body = await response.json() as { cr40f_ResponseJson?: string }
  if (!body.cr40f_ResponseJson) throw new Error('A Custom API não retornou o resultado da operação.')
  return JSON.parse(body.cr40f_ResponseJson) as SubmitResult
}
