import { ChevronRight, Pencil, Users } from 'lucide-react'
import type { Payer } from '../../domain'
import { formatCurrency } from '../../money'
import { CompletedStep, StepValidation } from './StepShell'
import { Badge, Button } from './ui'
import { PayerRow } from './PayerRow'

export function PayerList({
  payers,
  collapsed,
  errors,
  onChange,
  onEdit,
  onEditSelection,
  onContinue,
  invalidAmountIds,
  warnings,
  onAmountValidityChange,
  requiresRecipientConfirmation
}: {
  payers: Payer[]
  collapsed: boolean
  errors: string[]
  onChange: (id: string, change: Partial<Payer>) => void
  onEdit: () => void
  onEditSelection: () => void
  onContinue: () => void
  invalidAmountIds: Set<string>
  warnings: Map<string, string>
  onAmountValidityChange: (id: string, invalid: boolean) => void
  requiresRecipientConfirmation: boolean
}) {
  const total = payers.reduce((sum, payer) => sum + payer.amountCents, 0)
  if (collapsed) {
    return <CompletedStep id="step-review" step={2} label="REVISÃO" summary={`${payers.length} ${payers.length === 1 ? 'pagante' : 'pagantes'} · ${formatCurrency(total)}`} onEdit={onEdit} />
  }

  return <section id="step-review" className="panel payer-review step-panel step-panel--active" tabIndex={-1}>
    <div className="panel-heading">
      <div><span className="section-kicker">2. REVISÃO</span><h2>Pagantes e cobrança</h2></div>
      <div className="payer-list-actions"><Badge tone="info"><Users size={14} />{payers.length}</Badge><Button className="button-compact" onClick={onEditSelection}><Pencil size={15} />Alterar pagantes</Button></div>
    </div>
    <div className="payer-list payer-list--master">
      {payers.map((payer) => <PayerRow key={payer.id} payer={payer} invalidAmount={invalidAmountIds.has(payer.id)} warning={warnings.get(payer.id)} onAmountValidityChange={(invalid) => onAmountValidityChange(payer.id, invalid)} onChange={(change) => onChange(payer.id, change)} />)}
    </div>
    <StepValidation id="step-review-errors" errors={errors} />
    <div className="step-actions">
      <Button variant="primary" aria-disabled={errors.length > 0} aria-describedby={errors.length ? 'step-review-errors' : undefined} onClick={onContinue}>{requiresRecipientConfirmation ? 'Confirmar destinatários' : 'Continuar'}<ChevronRight size={17} /></Button>
    </div>
  </section>
}
