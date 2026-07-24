import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, type Mock } from 'vitest'
import type { Payer, Person, PersonSearch, PersonSearchPage } from '../../domain'
import { RecipientConfirmation } from './RecipientConfirmation'

const juliana: Payer = { id: '10000000-0000-0000-0000-000000000002', name: 'Juliana Rodrigues', email: 'juliana@empresa.com.br', phone: '', role: 'Passageiro', amountCents: 10000, paymentMethod: 202410000, generateLink: true, sendEmail: true, recipientId: '10000000-0000-0000-0000-000000000002', recipientName: 'Juliana Rodrigues', recipientEmail: 'juliana@empresa.com.br', linkStatus: 'NotApplicable', emailStatus: 'NotApplicable' }
const deborah: Person = { id: '10000000-0000-0000-0000-000000000001', name: 'Deborah', email: 'deborah@empresa.com.br', phone: '', role: 'Solicitante' }

function renderRecipient(options: { payers?: Payer[]; people?: Person[]; collapsed?: boolean; onChange?: Mock<(payerId: string, recipient: Person) => void>; onSearchDirectory?: PersonSearch } = {}) {
  const onChange = options.onChange ?? vi.fn<(payerId: string, recipient: Person) => void>()
  return {
    onChange,
    ...render(<RecipientConfirmation payers={options.payers ?? [juliana]} people={options.people ?? [juliana, deborah]} collapsed={options.collapsed ?? false} errors={[]} onChange={onChange} onEdit={vi.fn()} onContinue={vi.fn()} onSearchDirectory={options.onSearchDirectory} />)
  }
}

describe('RecipientConfirmation', () => {
  it('mantém recibo no pagante e permite escolher outra pessoa com e-mail', () => {
    const { onChange } = renderRecipient()
    expect(screen.getByText('Juliana Rodrigues', { selector: '.recipient-card__receipt strong' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /alterar destinatário/i }))
    fireEvent.click(screen.getByRole('radio', { name: /deborah/i }))
    expect(onChange).toHaveBeenCalledWith(juliana.id, deborah)
  })

  it('não permite escolher pessoa sem e-mail', () => {
    const withoutEmail: Person = { ...deborah, id: '10000000-0000-0000-0000-000000000003', name: 'Sem E-mail', email: '' }
    renderRecipient({ people: [withoutEmail] })
    fireEvent.click(screen.getByRole('button', { name: /alterar destinatário/i }))
    expect(screen.getByRole('radio', { name: /sem e-mail/i }).hasAttribute('disabled')).toBe(true)
  })

  it('pesquisa todo o cadastro somente após Adicionar destinatário', async () => {
    const remotePerson: Person = { ...deborah, id: '10000000-0000-0000-0000-000000000004', name: 'Pessoa Remota', role: 'Adicionado' }
    const onSearchDirectory = vi.fn().mockResolvedValue({ people: [remotePerson] })
    renderRecipient({ onSearchDirectory })
    fireEvent.click(screen.getByRole('button', { name: /alterar destinatário/i }))
    expect(onSearchDirectory).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /adicionar destinatário/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /buscar destinatário/i }), { target: { value: 'Pessoa' } })
    await waitFor(() => expect(onSearchDirectory).toHaveBeenCalledWith('Pessoa'))
    expect(await screen.findByRole('radio', { name: /pessoa remota/i })).toBeTruthy()
  })

  it('repassa nextLink, agrega a próxima página e remove duplicados', async () => {
    const first: Person = { ...deborah, id: '10000000-0000-0000-0000-000000000004', name: 'Pessoa Remota', role: 'Adicionado' }
    const second: Person = { ...deborah, id: '10000000-0000-0000-0000-000000000005', name: 'Pessoa Seguinte', role: 'Adicionado' }
    const onSearchDirectory = vi.fn()
      .mockResolvedValueOnce({ people: [first], nextLink: 'next-page' })
      .mockResolvedValueOnce({ people: [first, second] })
    renderRecipient({ onSearchDirectory })
    fireEvent.click(screen.getByRole('button', { name: /alterar destinatário/i }))
    fireEvent.click(screen.getByRole('button', { name: /adicionar destinatário/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /buscar destinatário/i }), { target: { value: 'Pessoa' } })
    await screen.findByRole('radio', { name: /pessoa remota/i })
    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }))
    await waitFor(() => expect(onSearchDirectory).toHaveBeenLastCalledWith('Pessoa', 'next-page'))
    expect(await screen.findByRole('radio', { name: /pessoa seguinte/i })).toBeTruthy()
    expect(screen.getAllByRole('radio', { name: /pessoa remota/i })).toHaveLength(1)
  })

  it('descarta uma página atrasada depois de sair da busca no cadastro', async () => {
    const first: Person = { ...deborah, id: '10000000-0000-0000-0000-000000000004', name: 'Pessoa Remota', role: 'Adicionado' }
    const late: Person = { ...deborah, id: '10000000-0000-0000-0000-000000000005', name: 'Página Atrasada', role: 'Adicionado' }
    let resolveNextPage: ((page: PersonSearchPage) => void) | undefined
    const onSearchDirectory = vi.fn()
      .mockResolvedValueOnce({ people: [first], nextLink: 'next-page' })
      .mockImplementationOnce(() => new Promise<PersonSearchPage>((resolve) => { resolveNextPage = resolve }))
    renderRecipient({ onSearchDirectory })
    fireEvent.click(screen.getByRole('button', { name: /alterar destinatário/i }))
    fireEvent.click(screen.getByRole('button', { name: /adicionar destinatário/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /buscar destinatário/i }), { target: { value: 'Pessoa' } })
    await screen.findByRole('radio', { name: /pessoa remota/i })
    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }))
    fireEvent.click(screen.getByRole('button', { name: /pessoas da op/i }))
    await act(async () => resolveNextPage?.({ people: [late] }))
    expect(screen.queryByRole('radio', { name: /página atrasada/i })).toBeNull()
  })

  it('descarta resultado atrasado quando a consulta deixa de ser válida', async () => {
    const remotePerson: Person = { ...deborah, id: '10000000-0000-0000-0000-000000000004', name: 'Pessoa Atrasada', role: 'Adicionado' }
    let resolveSearch: ((page: PersonSearchPage) => void) | undefined
    const onSearchDirectory = vi.fn(() => new Promise<PersonSearchPage>((resolve) => { resolveSearch = resolve }))
    renderRecipient({ onSearchDirectory })
    fireEvent.click(screen.getByRole('button', { name: /alterar destinatário/i }))
    fireEvent.click(screen.getByRole('button', { name: /adicionar destinatário/i }))
    const input = screen.getByRole('textbox', { name: /buscar destinatário/i })
    fireEvent.change(input, { target: { value: 'Pessoa' } })
    await waitFor(() => expect(onSearchDirectory).toHaveBeenCalledWith('Pessoa'))
    fireEvent.change(input, { target: { value: 'P' } })
    await act(async () => resolveSearch?.({ people: [remotePerson] }))
    expect(screen.queryByRole('radio', { name: /pessoa atrasada/i })).toBeNull()
    expect(screen.getByText('Digite pelo menos 2 caracteres.')).toBeTruthy()
  })

  it('recolhe a etapa concluída em resumo editável', () => {
    renderRecipient({ collapsed: true })
    expect(screen.getByText('1 e-mail confirmado')).toBeTruthy()
    expect(screen.getByRole('button', { name: /alterar/i })).toBeTruthy()
    expect(screen.queryByText('Confirme o destinatário do e-mail')).toBeNull()
  })

  it('mantém destinatários independentes para dois pagantes', () => {
    const carlos: Payer = {
      ...juliana,
      id: '10000000-0000-0000-0000-000000000006',
      name: 'Carlos Mendes',
      email: 'carlos@empresa.com.br',
      recipientId: deborah.id,
      recipientName: deborah.name,
      recipientEmail: deborah.email
    }
    renderRecipient({ payers: [juliana, carlos], people: [juliana, carlos, deborah] })
    expect(screen.getAllByText('Juliana Rodrigues')).toHaveLength(2)
    expect(screen.getByText('Carlos Mendes', { selector: '.recipient-card__receipt strong' })).toBeTruthy()
    expect(screen.getByText('Deborah', { selector: '.recipient-card__identity strong' })).toBeTruthy()
  })
})
