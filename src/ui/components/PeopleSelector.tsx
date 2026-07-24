import { ChevronRight, Plus, Search, UserRound } from 'lucide-react'
import type { Person } from '../../domain'
import { CompletedStep, StepValidation } from './StepShell'
import { Button } from './ui'

type Props = {
  people: Person[]
  selectedIds: Set<string>
  query: string
  collapsed: boolean
  errors: string[]
  onQueryChange: (value: string) => void
  onToggle: (person: Person) => void
  onAddExternal: () => void
  onSplit: () => void
  onContinue: () => void
  onEdit: () => void
}

export function PeopleSelector({ people, selectedIds, query, collapsed, errors, onQueryChange, onToggle, onAddExternal, onSplit, onContinue, onEdit }: Props) {
  if (collapsed) {
    return <CompletedStep id="step-payers" step={1} label="PAGANTES" summary={`${selectedIds.size} ${selectedIds.size === 1 ? 'pessoa selecionada' : 'pessoas selecionadas'}`} onEdit={onEdit} />
  }

  return <section id="step-payers" className="panel step-panel step-panel--active" tabIndex={-1}>
    <div className="panel-heading">
      <div><span className="section-kicker">1. PAGANTES</span><h2>Quem vai pagar?</h2><p>Selecione uma ou mais pessoas para dividir a cobrança.</p></div>
      <Button className="button-compact" onClick={onSplit} disabled={!selectedIds.size}>Dividir igualmente</Button>
    </div>
    <label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar envolvido</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar pessoa" /></label>
    <div className="people-grid">
      {people.length ? people.map((person) => <label className={`person-option ${selectedIds.has(person.id) ? 'is-selected' : ''}`} key={person.id}>
        <input aria-label={`Selecionar ${person.name}`} type="checkbox" checked={selectedIds.has(person.id)} onChange={() => onToggle(person)} />
        <span className="person-option__avatar"><UserRound size={15} /></span>
        <span><strong>{person.name}</strong><small>{person.role} · {person.email || 'Sem e-mail'}</small></span>
      </label>) : <div className="empty-state"><strong>Nenhuma pessoa encontrada</strong><span>Tente outro nome ou adicione um pagante externo.</span></div>}
    </div>
    <StepValidation id="step-payers-errors" errors={errors} />
    <div className="selection-actions">
      <Button className="add-external" onClick={onAddExternal}><Plus size={16} />Adicionar externo</Button>
      <Button variant="primary" className="selection-continue" aria-disabled={!selectedIds.size} aria-describedby={errors.length ? 'step-payers-errors' : undefined} onClick={onContinue}>Continuar<ChevronRight size={17} /></Button>
    </div>
  </section>
}
