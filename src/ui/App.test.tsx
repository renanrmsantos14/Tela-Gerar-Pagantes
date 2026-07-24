// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { demoOperation } from '../demo'
import type { Payer } from '../domain'

vi.stubGlobal('__APP_VERSION__', '0.2.69')
vi.stubGlobal('__APP_DATE__', '23/07/2026')

const mocks = vi.hoisted(() => ({
  loadOperation: vi.fn(),
  submitOperation: vi.fn(),
  searchDirectoryPeople: vi.fn(),
  logAppError: vi.fn()
}))

vi.mock('../dataverse', () => ({
  getRecordIdFromLocation: () => null,
  loadOperation: mocks.loadOperation,
  submitOperation: mocks.submitOperation,
  searchDirectoryPeople: mocks.searchDirectoryPeople
}))
vi.mock('../errorLogger', () => ({ logAppError: mocks.logAppError }))

describe('fluxo de etapas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadOperation.mockResolvedValue(demoOperation)
    mocks.searchDirectoryPeople.mockResolvedValue({ people: [] })
    mocks.submitOperation.mockResolvedValue({
      success: true,
      requestId: 'request-id',
      financeiroId: demoOperation.id,
      totalCents: demoOperation.totalCents,
      results: [],
      errors: []
    })
  })

  it('recolhe as três etapas e só libera a geração após concluí-las', async () => {
    const { App } = await import('./App')
    render(<App />)
    await screen.findByRole('heading', { name: /quem vai pagar/i })
    const generate = screen.getByRole('button', { name: /gerar pagantes/i })
    expect(generate.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(generate)
    expect(await screen.findByText('Selecione pelo menos um pagante.')).toBeTruthy()
    expect(mocks.submitOperation).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox', { name: /selecionar carlos mendes/i }))
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }))
    expect(await screen.findByRole('heading', { name: /pagantes e cobrança/i })).toBeTruthy()
    expect(screen.getByText('1 pessoa selecionada')).toBeTruthy()

    fireEvent.click(generate)
    expect(await screen.findByText('Confirme a revisão para abrir os destinatários.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /confirmar destinatários/i }))
    expect(await screen.findByRole('heading', { name: /confirme o destinatário do e-mail/i })).toBeTruthy()
    expect(screen.getByText(/1 pagante · R\$ 4\.827,50/)).toBeTruthy()

    fireEvent.click(generate)
    expect(await screen.findByText('Conclua os destinatários para liberar a geração.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /concluir etapa/i }))
    expect(await screen.findByText('1 e-mail confirmado')).toBeTruthy()
    expect(screen.getAllByText('Etapa concluída')).toHaveLength(3)
    expect(generate.getAttribute('aria-disabled')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: /alterar revisão/i }))
    expect(await screen.findByRole('heading', { name: /pagantes e cobrança/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /confirme o destinatário do e-mail/i })).toBeNull()
    expect(generate.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /confirmar destinatários/i }))
    fireEvent.click(await screen.findByRole('button', { name: /concluir etapa/i }))
    fireEvent.click(generate)
    await waitFor(() => expect(mocks.submitOperation).toHaveBeenCalledOnce())
  })

  it('memoriza a confirmação de rateio divergente até a geração', async () => {
    const { App } = await import('./App')
    render(<App />)
    await screen.findByRole('heading', { name: /quem vai pagar/i })
    fireEvent.click(screen.getByRole('checkbox', { name: /selecionar carlos mendes/i }))
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }))
    const amount = await screen.findByRole('textbox', { name: /valor de carlos mendes/i })
    fireEvent.focus(amount)
    fireEvent.change(amount, { target: { value: 'R$ 1,00' } })
    fireEvent.blur(amount)
    fireEvent.click(screen.getByRole('button', { name: /confirmar destinatários/i }))
    expect(await screen.findByRole('heading', { name: /rateio divergente/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /continuar mesmo assim/i }))
    fireEvent.click(await screen.findByRole('button', { name: /concluir etapa/i }))
    fireEvent.click(screen.getByRole('button', { name: /gerar pagantes/i }))
    await waitFor(() => expect(mocks.submitOperation).toHaveBeenCalledOnce())
    expect(mocks.submitOperation.mock.calls[0][1]).toEqual(expect.objectContaining({ allowTotalMismatch: true }))
    expect(screen.queryByRole('heading', { name: /rateio divergente/i })).toBeNull()
  })

  it('bloqueia a conclusão quando o destinatário carregado não possui e-mail', async () => {
    const payer: Payer = {
      ...demoOperation.people[1],
      amountCents: demoOperation.totalCents,
      paymentMethod: 202410000,
      generateLink: true,
      sendEmail: true,
      recipientId: demoOperation.people[2].id,
      recipientName: demoOperation.people[2].name,
      recipientEmail: '',
      linkStatus: 'NotApplicable',
      emailStatus: 'NotApplicable'
    }
    mocks.loadOperation.mockResolvedValueOnce({ ...demoOperation, payers: [payer] })
    const { App } = await import('./App')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /confirmar destinatários/i }))
    fireEvent.click(await screen.findByRole('button', { name: /concluir etapa/i }))
    expect(await screen.findByText('Escolha um destinatário cadastrado com nome e e-mail válidos para cada envio.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /gerar pagantes/i }).getAttribute('aria-disabled')).toBe('true')
    expect(mocks.submitOperation).not.toHaveBeenCalled()
  })

  it('envia destinatários diferentes sem alterar o nome de cada pagante', async () => {
    const carlos: Payer = {
      ...demoOperation.people[1],
      amountCents: 241375,
      paymentMethod: 202410000,
      generateLink: true,
      sendEmail: true,
      recipientId: demoOperation.people[0].id,
      recipientName: demoOperation.people[0].name,
      recipientEmail: demoOperation.people[0].email,
      linkStatus: 'NotApplicable',
      emailStatus: 'NotApplicable'
    }
    const mariana: Payer = {
      ...demoOperation.people[0],
      amountCents: 241375,
      paymentMethod: 202410000,
      generateLink: true,
      sendEmail: true,
      recipientId: demoOperation.people[1].id,
      recipientName: demoOperation.people[1].name,
      recipientEmail: demoOperation.people[1].email,
      linkStatus: 'NotApplicable',
      emailStatus: 'NotApplicable'
    }
    mocks.loadOperation.mockResolvedValueOnce({ ...demoOperation, payers: [carlos, mariana] })
    const { App } = await import('./App')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /confirmar destinatários/i }))
    fireEvent.click(await screen.findByRole('button', { name: /concluir etapa/i }))
    fireEvent.click(screen.getByRole('button', { name: /gerar pagantes/i }))
    fireEvent.click(await screen.findByRole('button', { name: /substituir/i }))
    await waitFor(() => expect(mocks.submitOperation).toHaveBeenCalledOnce())
    expect(mocks.submitOperation.mock.calls[0][1].pagantes).toEqual([
      expect.objectContaining({ name: 'Carlos Mendes', recipientName: 'Mariana Costa', recipientEmail: 'mariana.costa@empresa.com.br' }),
      expect.objectContaining({ name: 'Mariana Costa', recipientName: 'Carlos Mendes', recipientEmail: 'carlos.mendes@empresa.com.br' })
    ])
  })
})
