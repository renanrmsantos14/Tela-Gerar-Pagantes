// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SubmitRequest, SubmitResult } from './domain'

const financeiroId = '10000000-0000-0000-0000-000000000001'
const paganteId = '20000000-0000-0000-0000-000000000001'
const pagantesRecordId = '30000000-0000-0000-0000-000000000001'

const request: SubmitRequest = {
  requestId: '40000000-0000-0000-0000-000000000001',
  expectedFinanceiroVersion: '10',
  financeiroDisplayId: 'OP-123',
  totalCents: 12500,
  allowTotalMismatch: false,
  serviceStartDate: '2026-07-23',
  serviceEndDate: '2026-07-23',
  pagantes: [{
    paganteId,
    name: 'Pagante',
    email: 'pagante@example.com',
    recipientId: paganteId,
    recipientName: 'Pagante',
    recipientEmail: 'pagante@example.com',
    amountCents: 12500,
    paymentMethod: 202410000,
    generateLink: true,
    sendEmail: true
  }]
}

afterEach(() => {
  delete window.Xrm
  vi.restoreAllMocks()
})

describe('submitOperation', () => {
  it('valida a OP e delega toda a gravação para a Custom API', async () => {
    const result: SubmitResult = {
      success: true,
      requestId: request.requestId,
      financeiroId,
      totalCents: request.totalCents,
      results: [{ paganteId, pagantesRecordId, linkStatus: 'Generated', emailStatus: 'Sent' }],
      errors: []
    }
    const execute = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ cr40f_ResponseJson: JSON.stringify(result) })
    })
    const createRecord = vi.fn()
    const updateRecord = vi.fn()
    const deleteRecord = vi.fn()
    const retrieveMultipleRecords = vi.fn()
      .mockResolvedValueOnce({ entities: [{ cr40f_reservadeveculosid: '50000000-0000-0000-0000-000000000001' }] })
      .mockResolvedValueOnce({ entities: [{ new_valortotal: 125 }] })
    window.Xrm = {
      WebApi: {
        retrieveRecord: vi.fn().mockResolvedValue({ versionnumber: '10', statecode: 0, statuscode: 1 }),
        retrieveMultipleRecords,
        createRecord,
        updateRecord,
        deleteRecord,
        online: { execute }
      }
    }
    const { submitOperation } = await import('./dataverse')

    await expect(submitOperation(financeiroId, request)).resolves.toEqual(result)
    expect(execute).toHaveBeenCalledOnce()
    expect(createRecord).not.toHaveBeenCalled()
    expect(updateRecord).not.toHaveBeenCalled()
    expect(deleteRecord).not.toHaveBeenCalled()
    const apiRequest = execute.mock.calls[0][0]
    expect(apiRequest.getMetadata()).toEqual(expect.objectContaining({
      boundParameter: 'Target',
      operationName: 'cr40f_GerarPagantes'
    }))
  })
})
