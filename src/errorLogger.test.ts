import { afterEach, describe, expect, it, vi } from 'vitest'
import { logAppError } from './errorLogger'

describe('logAppError', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete window.Xrm
  })

  it('grava erros no contrato da tabela de logs', async () => {
    const createRecord = vi.fn().mockResolvedValue({ id: 'log-id' })
    window.Xrm = { WebApi: { retrieveRecord: vi.fn(), retrieveMultipleRecords: vi.fn(), createRecord, updateRecord: vi.fn(), deleteRecord: vi.fn() } }

    await logAppError(new Error('Falha de teste'), { action: 'test', detailId: 'finance-id' })

    expect(createRecord).toHaveBeenCalledWith('new_appmotoristaslog', expect.objectContaining({
      new_message: 'Falha de teste',
      new_action: 'test',
      new_detailid: 'finance-id',
      new_appname: 'Tela Gerar Pagantes'
    }))
  })

  it('nao propaga falha do proprio logger', async () => {
    window.Xrm = { WebApi: { retrieveRecord: vi.fn(), retrieveMultipleRecords: vi.fn(), createRecord: vi.fn().mockRejectedValue(new Error('Dataverse indisponivel')), updateRecord: vi.fn(), deleteRecord: vi.fn() } }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(logAppError('Falha original')).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalledOnce()
  })
})
