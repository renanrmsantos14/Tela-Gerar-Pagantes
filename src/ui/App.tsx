import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OperationData, Payer, Person } from '../domain'
import { getRecordIdFromLocation, loadOperation, submitOperation } from '../dataverse'
import { formatCurrency, splitEvenly } from '../money'
import { AllocationSummary } from './components/AllocationSummary'
import { ExternalPayerDialog } from './components/ExternalPayerDialog'
import { FeedbackNotice } from './components/FeedbackNotice'
import { OperationHeader } from './components/OperationHeader'
import { PayerList } from './components/PayerList'
import { PeopleSelector } from './components/PeopleSelector'
import { PopupShell } from './components/PopupShell'
import { StatusConfirmationDialog } from './components/StatusConfirmationDialog'
import { StickyActionBar } from './components/StickyActionBar'

const appVersion = `v${__APP_VERSION__} ${__APP_DATE__}`
type Notice = { tone: 'error' | 'success'; text: string } | null

const emailValid = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim())
const makePayer = (person: Person, amountCents = 0): Payer => ({ ...person, amountCents, paymentMethod: 202410000, generateLink: true, sendEmail: true, linkStatus: 'NotApplicable', emailStatus: 'NotApplicable' })

export function App() {
  const [operation, setOperation] = useState<OperationData | null>(null)
  const [payers, setPayers] = useState<Payer[]>([])
  const [query, setQuery] = useState('')
  const [externalQuery, setExternalQuery] = useState('')
  const [externalOpen, setExternalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [selectionComplete, setSelectionComplete] = useState(false)
  const isEmbedded = new URLSearchParams(window.location.search).get('embedded') === '1'

  function closeEmbedded(refresh = false) {
    if (!isEmbedded || window.parent === window) return
    window.parent.postMessage({ type: 'cr40f-gerar-pagantes:close', refresh }, window.location.origin)
  }

  const refresh = useCallback(async () => {
    setLoading(true); setNotice(null)
    try {
      const id = getRecordIdFromLocation()
      if (!id && window.Xrm?.WebApi) throw new Error('Nenhuma OP foi recebida pela tela.')
      const data = await loadOperation(id ?? '00000000-0000-0000-0000-000000000001')
      setOperation(data); setPayers(data.payers); setSelectionComplete(data.payers.length > 0)
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Não foi possível carregar a OP.' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const totalRateado = useMemo(() => payers.reduce((sum, payer) => sum + payer.amountCents, 0), [payers])
  const remaining = (operation?.totalCents ?? 0) - totalRateado
  const selectedIds = useMemo(() => new Set(payers.map((payer) => payer.id)), [payers])
  const involvedPeople = useMemo(() => (operation?.people ?? []).filter((person) => `${person.name} ${person.email} ${person.role}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))), [operation, query])
  const errors = useMemo(() => {
    if (!operation) return []
    const messages: string[] = []
    if (!payers.length) messages.push('Selecione pelo menos um pagante.')
    if (payers.some((payer) => payer.amountCents <= 0)) messages.push('Todo pagante deve possuir valor maior que zero.')
    if (remaining !== 0) messages.push(`Rateio deve totalizar ${formatCurrency(operation.totalCents)}.`)
    if (payers.some((payer) => payer.generateLink && !emailValid(payer.email))) messages.push('Informe um e-mail válido para quem receberá link de pagamento.')
    return messages
  }, [operation, payers, remaining])

  const rebalance = useCallback((next: Payer[]) => {
    if (!operation) return
    const shares = splitEvenly(operation.totalCents, next.map((payer) => payer.id))
    setPayers(next.map((payer) => ({ ...payer, amountCents: shares.get(payer.id) ?? 0 })))
  }, [operation])

  function togglePerson(person: Person) {
    const next = payers.some((payer) => payer.id === person.id) ? payers.filter((payer) => payer.id !== person.id) : [...payers, makePayer(person)]
    rebalance(next)
  }

  function addExternal(person: Person) {
    if (selectedIds.has(person.id)) return
    rebalance([...payers, makePayer({ ...person, role: 'Adicionado' })]); setExternalOpen(false); setExternalQuery('')
  }

  function updatePayer(id: string, change: Partial<Payer>) { setPayers((current) => current.map((payer) => payer.id === id ? { ...payer, ...change } : payer)) }

  async function save() {
    setAttemptedSave(true)
    if (!operation || errors.length || saving) return
    const risky = payers.some((payer) => payer.existingPayerId && payer.paymentStatus && payer.paymentStatus !== 'Pendente')
    if (risky) { setConfirmOpen(true); return }
    await executeSave()
  }

  async function executeSave() {
    if (!operation) return
    setSaving(true); setNotice(null)
    try {
      const result = await submitOperation(operation.id, { requestId: crypto.randomUUID(), expectedFinanceiroVersion: operation.version, pagantes: payers.map((payer) => ({ paganteId: payer.id, existingPaganteId: payer.existingPayerId, amountCents: payer.amountCents, paymentMethod: payer.paymentMethod, generateLink: payer.generateLink, sendEmail: payer.sendEmail })) })
      if (!result.success) throw new Error(result.errors.map((error) => error.message).join(' ') || 'A operação não foi concluída.')
      setNotice({ tone: 'success', text: 'Pagantes gravados. E-mails serão enviados após o processamento.' }); setConfirmOpen(false); await refresh()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Não foi possível gerar os pagantes.' })
    } finally { setSaving(false) }
  }

  if (loading) return <div className="state-screen"><div className="skeleton skeleton--title" /><div className="skeleton skeleton--panel" /><small>{appVersion}</small></div>
  if (!operation) return <div className="state-screen"><strong>Não foi possível abrir esta OP.</strong>{notice ? <FeedbackNotice {...notice} /> : null}<button className="ui-button ui-button--secondary" onClick={() => void refresh()}>Tentar novamente</button><small>{appVersion}</small></div>

  const actionHint = !selectionComplete ? 'Escolha os pagantes e avance' : errors.length ? 'Revise os campos pendentes' : 'Rateio pronto para gerar'

  return <PopupShell onBackdropClick={isEmbedded ? () => closeEmbedded(false) : undefined}>
    <OperationHeader displayId={operation.displayId} serviceCount={operation.serviceCount} balanced={remaining === 0} onRefresh={() => void refresh()} onClose={isEmbedded ? () => closeEmbedded(true) : undefined} />
    {notice ? <FeedbackNotice {...notice} /> : null}
    <AllocationSummary totalCents={operation.totalCents} allocatedCents={totalRateado} remainingCents={remaining} />
    <PeopleSelector people={involvedPeople} selectedIds={selectedIds} query={query} collapsed={selectionComplete} onQueryChange={setQuery} onToggle={togglePerson} onAddExternal={() => setExternalOpen(true)} onSplit={() => rebalance(payers)} onContinue={() => setSelectionComplete(true)} onEdit={() => setSelectionComplete(false)} />
    {selectionComplete ? <PayerList payers={payers} onChange={updatePayer} onEditSelection={() => setSelectionComplete(false)} /> : null}
    {attemptedSave && errors.length ? <div className="validation-panel" role="alert"><strong>Revise antes de continuar</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
    <StickyActionBar version={appVersion} hint={actionHint} ready={selectionComplete && !errors.length} saving={saving} confirm={false} onSave={() => void save()} />
    <ExternalPayerDialog open={externalOpen} people={operation.directory} selectedIds={selectedIds} query={externalQuery} onQueryChange={setExternalQuery} onClose={() => setExternalOpen(false)} onSelect={addExternal} />
    <StatusConfirmationDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => void executeSave()} />
  </PopupShell>
}
