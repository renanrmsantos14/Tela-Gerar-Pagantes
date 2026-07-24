import { AlertCircle, Check, Pencil } from 'lucide-react'
import { Badge, Button } from './ui'

export function CompletedStep({
  id,
  step,
  label,
  summary,
  onEdit
}: {
  id: string
  step: number
  label: string
  summary: string
  onEdit: () => void
}) {
  return <section id={id} className="panel panel--compact step-panel step-panel--complete" tabIndex={-1}>
    <div className="compact-step">
      <div><span className="section-kicker">{step}. {label}</span><h2>{summary}</h2></div>
      <div className="compact-step__actions">
        <Badge tone="success"><Check size={13} />Etapa concluída</Badge>
        <Button className="button-compact" aria-label={`Alterar ${label.toLocaleLowerCase('pt-BR')}`} onClick={onEdit}><Pencil size={15} />Alterar</Button>
      </div>
    </div>
  </section>
}

export function StepValidation({ id, errors }: { id: string; errors: string[] }) {
  if (!errors.length) return null
  return <div id={id} className="step-validation" role="alert">
    <AlertCircle size={17} aria-hidden="true" />
    <div><strong>Para continuar</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>
  </div>
}
