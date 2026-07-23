import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Payer, Person } from '../../domain'
import { RecipientConfirmation } from './RecipientConfirmation'

const juliana: Payer = { id: '10000000-0000-0000-0000-000000000002', name: 'Juliana Rodrigues', email: 'juliana@empresa.com.br', phone: '', role: 'Passageiro', amountCents: 10000, paymentMethod: 202410000, generateLink: true, sendEmail: true, recipientId: '10000000-0000-0000-0000-000000000002', recipientName: 'Juliana Rodrigues', recipientEmail: 'juliana@empresa.com.br', linkStatus: 'NotApplicable', emailStatus: 'NotApplicable' }
const deborah: Person = { id: '10000000-0000-0000-0000-000000000001', name: 'Deborah', email: 'deborah@empresa.com.br', phone: '', role: 'Solicitante' }

describe('RecipientConfirmation', () => {
  it('mantém recibo no pagante e permite escolher outra pessoa com e-mail', () => {
    const onChange = vi.fn()
    render(<RecipientConfirmation payers={[juliana]} people={[juliana, deborah]} onChange={onChange} onBack={vi.fn()} />)
    expect(screen.getByText('Juliana Rodrigues', { selector: '.recipient-card__receipt strong' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /alterar destinatário/i }))
    fireEvent.click(screen.getByRole('radio', { name: /deborah/i }))
    expect(onChange).toHaveBeenCalledWith(juliana.id, deborah)
  })

  it('não permite escolher pessoa sem e-mail', () => {
    const withoutEmail: Person = { ...deborah, id: '10000000-0000-0000-0000-000000000003', name: 'Sem E-mail', email: '' }
    render(<RecipientConfirmation payers={[juliana]} people={[withoutEmail]} onChange={vi.fn()} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /alterar destinatário/i }))
    expect(screen.getByRole('radio', { name: /sem e-mail/i }).hasAttribute('disabled')).toBe(true)
  })

  it('pesquisa todo o cadastro somente após a ação explícita', async () => {
    const remotePerson: Person = { ...deborah, id: '10000000-0000-0000-0000-000000000004', name: 'Pessoa Remota', role: 'Adicionado' }
    const onSearchDirectory = vi.fn().mockResolvedValue({ people: [remotePerson] })
    render(<RecipientConfirmation payers={[juliana]} people={[juliana, deborah]} onChange={vi.fn()} onBack={vi.fn()} onSearchDirectory={onSearchDirectory} />)
    fireEvent.click(screen.getByRole('button', { name: /alterar destinatário/i }))
    expect(onSearchDirectory).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /adicionar do cadastro/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /buscar destinatário/i }), { target: { value: 'Pessoa' } })
    await waitFor(() => expect(onSearchDirectory).toHaveBeenCalledWith('Pessoa'))
    expect(await screen.findByRole('radio', { name: /pessoa remota/i })).toBeTruthy()
  })
})
