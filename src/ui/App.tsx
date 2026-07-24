import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OperationData, Payer, Person } from '../domain'
import { getRecordIdFromLocation, loadOperation, searchDirectoryPeople, submitOperation } from '../dataverse'
import { logAppError } from '../errorLogger'
import { formatCurrency, splitEvenly } from '../money'
import { AllocationSummary } from './components/AllocationSummary'
import { AllocationMismatchDialog } from './components/AllocationMismatchDialog'
import { BlockingErrorDialog } from './components/BlockingErrorDialog'
import { ExternalPayerDialog } from './components/ExternalPayerDialog'
import { ExistingPayersDialog } from './components/ExistingPayersDialog'
import { FeedbackNotice } from './components/FeedbackNotice'
import { OperationHeader } from './components/OperationHeader'
import { PayerList } from './components/PayerList'
import { PeopleSelector } from './components/PeopleSelector'
import { RecipientConfirmation } from './components/RecipientConfirmation'
import { PopupShell } from './components/PopupShell'
import { StatusConfirmationDialog } from './components/StatusConfirmationDialog'
import { StickyActionBar } from './components/StickyActionBar'
import { SuccessFeedback } from './components/SuccessFeedback'

const appVersion = `v${__APP_VERSION__} ${__APP_DATE__}`
type Notice = { tone: 'error' | 'success'; text: string } | null

const emailValid = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim())
const guidValid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const recipientValid = (payer: Payer) => guidValid(payer.recipientId ?? payer.id) && Boolean((payer.recipientName ?? payer.name).trim()) && emailValid(payer.recipientEmail ?? payer.email)
const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) return error.message
  return fallback
}
const makePayer = (person: Person, amountCents = 0): Payer => ({ ...person, amountCents, paymentMethod: 202410000, generateLink: true, sendEmail: emailValid(person.email), recipientId: person.id, recipientName: person.name, recipientEmail: person.email, linkStatus: 'NotApplicable', emailStatus: 'NotApplicable' })

export function App() {
  const [operation, setOperation] = useState<OperationData | null>(null)
  const [payers, setPayers] = useState<Payer[]>([])
  const [query, setQuery] = useState('')
  const [externalQuery, setExternalQuery] = useState('')
  const [externalOpen, setExternalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [existingPayersOpen, setExistingPayersOpen] = useState(false)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [mismatchOpen, setMismatchOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [selectionComplete, setSelectionComplete] = useState(false)
  const [reviewComplete, setReviewComplete] = useState(false)
  const [recipientsConfirmed, setRecipientsConfirmed] = useState(false)
  const [mismatchAccepted, setMismatchAccepted] = useState(false)
  const [validationStep, setValidationStep] = useState<1 | 2 | 3 | null>(null)
  const [validationPrompt, setValidationPrompt] = useState('')
  const [invalidAmountIds, setInvalidAmountIds] = useState<Set<string>>(new Set())
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null)
  const [blockingError, setBlockingError] = useState<string | null>(null)
  const dirtyRef = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const isEmbedded = new URLSearchParams(window.location.search).get('embedded') === '1'

  function closeEmbedded(refresh = false) {
    if (!isEmbedded || window.parent === window) return
    if (dirtyRef.current && !window.confirm('Existem alterações não salvas. Deseja sair mesmo assim?')) return
    window.parent.postMessage({ type: 'cr40f-gerar-pagantes:close', refresh }, window.location.origin)
  }

  const refresh = useCallback(async (ignoreDirty = false) => {
    if (dirtyRef.current && !ignoreDirty && !window.confirm('Existem alterações não salvas. Deseja atualizar e descartá-las?')) return
    setLoading(true); setNotice(null)
    try {
      const id = getRecordIdFromLocation()
      if (!id && window.Xrm?.WebApi) throw new Error('Nenhuma OP foi recebida pela tela.')
      const data = await loadOperation(id ?? '00000000-0000-0000-0000-000000000001')
      setOperation(data); setPayers(data.payers.map((payer) => ({ ...payer, recipientId: payer.recipientId ?? payer.id, recipientName: payer.recipientName ?? payer.name, recipientEmail: payer.recipientEmail ?? payer.email }))); setSelectionComplete(data.payers.length > 0); setReviewComplete(false); setRecipientsConfirmed(false); setMismatchAccepted(false); setValidationStep(null); setValidationPrompt(''); setInvalidAmountIds(new Set()); setDirty(false)
      const failedLinks = data.payers.filter((payer) => payer.linkStatus === 'Failed')
      if (failedLinks.length) setNotice({ tone: 'error', text: `${failedLinks.length} link(s) de pagamento não foram gerados. Revise o Pagante e o histórico do Flow.` })
    } catch (error) {
      console.error('[GerarPagantes] Não foi possível carregar a OP.', error)
      await logAppError(error, { source: 'React', action: 'refresh', phase: 'load-operation', component: 'App' })
      setNotice({ tone: 'error', text: errorMessage(error, 'Não foi possível carregar a OP.') })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { dirtyRef.current = dirty }, [dirty])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (!successFeedback) return
    const timer = window.setTimeout(() => closeEmbedded(true), 1500)
    return () => window.clearTimeout(timer)
  }, [successFeedback])

  const totalRateado = useMemo(() => payers.reduce((sum, payer) => sum + payer.amountCents, 0), [payers])
  const remaining = (operation?.totalCents ?? 0) - totalRateado
  const selectedIds = useMemo(() => new Set(payers.map((payer) => payer.id)), [payers])
  const involvedPeople = useMemo(() => (operation?.people ?? []).filter((person) => `${person.name} ${person.email} ${person.role}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))), [operation, query])
  const deliveryPayers = useMemo(() => payers.filter((payer) => payer.generateLink && payer.sendEmail), [payers])
  const needsRecipientConfirmation = deliveryPayers.length > 0
  const selectionErrors = useMemo(() => payers.length ? [] : ['Selecione pelo menos um pagante.'], [payers.length])
  const reviewErrors = useMemo(() => {
    const messages: string[] = []
    if (payers.some((payer) => payer.amountCents <= 0)) messages.push('Informe um valor maior que zero para cada pagante.')
    if (invalidAmountIds.size) messages.push('Corrija os valores com mais de duas casas decimais.')
    if (!mismatchAccepted && remaining > 0) messages.push(`Falta ratear ${formatCurrency(remaining)} para fechar o total da OP.`)
    if (!mismatchAccepted && remaining < 0) messages.push(`O rateio excede o total da OP em ${formatCurrency(Math.abs(remaining))}.`)
    return messages
  }, [payers, remaining, invalidAmountIds, mismatchAccepted])
  const recipientErrors = useMemo(() => deliveryPayers.some((payer) => !recipientValid(payer)) ? ['Escolha um destinatário cadastrado com nome e e-mail válidos para cada envio.'] : [], [deliveryPayers])
  const allStepsComplete = selectionComplete && reviewComplete && (!needsRecipientConfirmation || recipientsConfirmed)
  const visibleSelectionErrors = validationStep === 1 ? (selectionErrors.length ? selectionErrors : [validationPrompt]) : []
  const visibleReviewErrors = validationStep === 2 ? (reviewErrors.length ? reviewErrors : [validationPrompt]) : []
  const visibleRecipientErrors = validationStep === 3 ? (recipientErrors.length ? recipientErrors : [validationPrompt]) : []

  const warnings = useMemo(() => {
    const result = new Map<string, string>()
    if (payers.length < 2) return result
    const average = totalRateado / payers.length
    payers.filter((payer) => payer.amountCents >= average * 3).forEach((payer) => result.set(payer.id, 'Valor muito acima da média do rateio.'))
    return result
  }, [payers, totalRateado])

  const focusStep = useCallback((step: 1 | 2 | 3) => {
    const id = step === 1 ? 'step-payers' : step === 2 ? 'step-review' : 'step-recipients'
    window.requestAnimationFrame(() => {
      const target = document.getElementById(id)
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      target?.focus({ preventScroll: true })
    })
  }, [])

  function showStepValidation(step: 1 | 2 | 3, prompt = '') {
    setValidationStep(step)
    setValidationPrompt(prompt)
    focusStep(step)
  }

  const rebalance = useCallback((next: Payer[]) => {
    if (!operation) return
    const shares = splitEvenly(operation.totalCents, next.map((payer) => payer.id))
    setSaved(false); setDirty(true); setReviewComplete(false); setRecipientsConfirmed(false); setMismatchAccepted(false); setValidationStep(null); setValidationPrompt('')
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

  function updatePayer(id: string, change: Partial<Payer>) { setSaved(false); setDirty(true); setReviewComplete(false); setRecipientsConfirmed(false); setMismatchAccepted(false); setValidationStep(null); setPayers((current) => current.map((payer) => payer.id === id ? { ...payer, ...change } : payer)) }

  function updateRecipient(payerId: string, person: Person) { setSaved(false); setDirty(true); setRecipientsConfirmed(false); setValidationStep(null); setPayers((current) => current.map((payer) => payer.id === payerId ? { ...payer, recipientId: person.id, recipientName: person.name, recipientEmail: person.email } : payer)) }

  function updateAmountValidity(id: string, invalid: boolean) {
    setReviewComplete(false); setRecipientsConfirmed(false); setMismatchAccepted(false)
    setInvalidAmountIds((current) => { const next = new Set(current); if (invalid) next.add(id); else next.delete(id); return next })
  }

  function editSelection() {
    setSelectionComplete(false); setReviewComplete(false); setRecipientsConfirmed(false); setMismatchAccepted(false); setValidationStep(null); setValidationPrompt('')
    focusStep(1)
  }

  function completeSelection() {
    if (selectionErrors.length) { showStepValidation(1); return }
    setSelectionComplete(true); setReviewComplete(false); setRecipientsConfirmed(false); setValidationStep(null); setValidationPrompt('')
    focusStep(2)
  }

  function editReview() {
    setReviewComplete(false); setRecipientsConfirmed(false); setValidationStep(null); setValidationPrompt('')
    focusStep(2)
  }

  function completeReview(acceptMismatch = mismatchAccepted) {
    const fieldErrors = reviewErrors.filter((error) => !error.startsWith('Falta ratear') && !error.startsWith('O rateio excede'))
    if (fieldErrors.length) { showStepValidation(2); return }
    if (remaining !== 0 && !acceptMismatch) { setValidationStep(2); setMismatchOpen(true); return }
    setMismatchAccepted(remaining !== 0)
    setReviewComplete(true); setRecipientsConfirmed(!needsRecipientConfirmation); setValidationStep(null); setValidationPrompt('')
    if (needsRecipientConfirmation) focusStep(3)
  }

  function editRecipients() {
    setRecipientsConfirmed(false); setValidationStep(null); setValidationPrompt('')
    focusStep(3)
  }

  function completeRecipients() {
    if (recipientErrors.length) { showStepValidation(3); return }
    setRecipientsConfirmed(true); setValidationStep(null); setValidationPrompt('')
    focusStep(3)
  }

  async function save() {
    if (!operation || saving) return
    if (!selectionComplete) { showStepValidation(1, 'Conclua a seleção de pagantes para continuar.'); return }
    if (!reviewComplete) { showStepValidation(2, 'Confirme a revisão para abrir os destinatários.'); return }
    if (needsRecipientConfirmation && !recipientsConfirmed) { showStepValidation(3, 'Conclua os destinatários para liberar a geração.'); return }
    if (reviewErrors.length) { setReviewComplete(false); setRecipientsConfirmed(false); showStepValidation(2); return }
    if (recipientErrors.length) { setRecipientsConfirmed(false); showStepValidation(3); return }
    if (operation.payers.length > 0 && !replaceExisting) { setExistingPayersOpen(true); return }
    const risky = payers.some((payer) => payer.existingPayerId && payer.paymentStatus && payer.paymentStatus !== 'Pendente')
    if (risky) { setConfirmOpen(true); return }
    await executeSave()
  }

  async function executeSave(forceReplace = replaceExisting) {
    if (!operation) return
    setSaving(true); setNotice(null); setSuccessFeedback(null); setBlockingError(null)
    try {
       const result = await submitOperation(operation.id, { requestId: crypto.randomUUID(), expectedFinanceiroVersion: operation.version, financeiroDisplayId: operation.displayId, totalCents: operation.totalCents, allowTotalMismatch: remaining !== 0, replaceExisting: forceReplace, serviceStartDate: operation.serviceStartDate, serviceEndDate: operation.serviceEndDate, pagantes: payers.map((payer) => ({ paganteId: payer.id, existingPaganteId: forceReplace ? undefined : payer.existingPayerId, name: payer.name, email: payer.email, recipientId: payer.recipientId ?? payer.id, recipientName: payer.recipientName ?? payer.name, recipientEmail: payer.recipientEmail ?? payer.email, amountCents: payer.amountCents, paymentMethod: payer.paymentMethod, generateLink: payer.generateLink, sendEmail: payer.sendEmail })) })
      if (!result.success) {
        const detail = result.errors.map((error) => error.message).join(' ') || 'O processamento não foi concluído.'
        throw new Error(`Pagantes gravados, mas a geração foi interrompida. ${detail} Corrija o erro e tente novamente.`)
      }
      setConfirmOpen(false)
      setExistingPayersOpen(false)
      setReplaceExisting(false)
      setSaved(true); setDirty(false)
      await refresh(true)
      setNotice(null)
      setSuccessFeedback('Pagantes processados. Links e e-mails foram confirmados.')
    } catch (error) {
      console.error('[GerarPagantes] Não foi possível gerar os pagantes.', { financeiroId: operation.id, error })
      await logAppError(error, { source: 'React', action: 'save', phase: 'submit-operation', component: 'App', detailId: operation.id, detailType: 'cr40f_financeiro' })
      setConfirmOpen(false)
      setMismatchOpen(false)
      const message = errorMessage(error, 'Não foi possível gerar os pagantes.')
      setNotice({ tone: 'error', text: message })
      setBlockingError(message)
      window.requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' }))
    } finally { setSaving(false) }
  }

  if (loading) return <div className="state-screen"><div className="skeleton skeleton--title" /><div className="skeleton skeleton--panel" /><small>{appVersion}</small></div>
  if (!operation) return <div className="state-screen"><strong>Não foi possível abrir esta OP.</strong>{notice ? <FeedbackNotice {...notice} /> : null}<button className="ui-button ui-button--secondary" onClick={() => void refresh()}>Tentar novamente</button><small>{appVersion}</small></div>

  const actionHint = saved ? 'Geração concluída' : !selectionComplete ? 'Etapa 1 de 2 · Selecione os pagantes' : !reviewComplete ? 'Etapa 2 de 2 · Revise a cobrança' : needsRecipientConfirmation && !recipientsConfirmed ? 'Etapa 3 de 3 · Confirme os destinatários' : needsRecipientConfirmation ? '3 etapas concluídas · Pronto para gerar' : '2 etapas concluídas · Pronto para gerar'

  return <PopupShell onBackdropClick={isEmbedded ? () => closeEmbedded(false) : undefined}>
    <div className="popup-content" ref={contentRef}>
      <OperationHeader displayId={operation.displayId} serviceCount={operation.serviceCount} balanced={remaining === 0} onRefresh={() => void refresh()} onClose={isEmbedded ? () => closeEmbedded(true) : undefined} />
      {notice ? <FeedbackNotice {...notice} /> : null}
      <AllocationSummary totalCents={operation.totalCents} allocatedCents={totalRateado} remainingCents={remaining} />
      <PeopleSelector people={involvedPeople} selectedIds={selectedIds} query={query} collapsed={selectionComplete} errors={visibleSelectionErrors} onQueryChange={setQuery} onToggle={togglePerson} onAddExternal={() => setExternalOpen(true)} onSplit={() => rebalance(payers)} onContinue={completeSelection} onEdit={editSelection} />
      {selectionComplete ? <PayerList payers={payers} collapsed={reviewComplete} errors={visibleReviewErrors} onChange={updatePayer} onEdit={editReview} onContinue={() => completeReview()} invalidAmountIds={invalidAmountIds} warnings={warnings} onAmountValidityChange={updateAmountValidity} onEditSelection={editSelection} requiresRecipientConfirmation={needsRecipientConfirmation} /> : null}
      {selectionComplete && reviewComplete && needsRecipientConfirmation ? <RecipientConfirmation payers={payers} people={operation.people} collapsed={recipientsConfirmed} errors={visibleRecipientErrors} onChange={updateRecipient} onEdit={editRecipients} onContinue={completeRecipients} onSearchDirectory={searchDirectoryPeople} /> : null}
    </div>
    <StickyActionBar version={appVersion} hint={actionHint} ready={allStepsComplete} saving={saving} completed={saved} onSave={() => void save()} />
    {successFeedback ? <SuccessFeedback text={successFeedback} /> : null}
    <ExternalPayerDialog open={externalOpen} selectedIds={selectedIds} query={externalQuery} onQueryChange={setExternalQuery} onClose={() => setExternalOpen(false)} onSelect={addExternal} onSearch={searchDirectoryPeople} />
    <StatusConfirmationDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => void executeSave()} />
    <ExistingPayersDialog payers={operation.payers} open={existingPayersOpen} onReview={() => setExistingPayersOpen(false)} onReplace={() => { setExistingPayersOpen(false); setReplaceExisting(true); void executeSave(true) }} />
    <AllocationMismatchDialog open={mismatchOpen} operationTotal={operation.totalCents} allocatedTotal={totalRateado} onClose={() => setMismatchOpen(false)} onContinue={() => { setMismatchOpen(false); completeReview(true) }} />
    <BlockingErrorDialog message={blockingError} onClose={() => setBlockingError(null)} />
  </PopupShell>
}
