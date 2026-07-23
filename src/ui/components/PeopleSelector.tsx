import { ChevronRight, Pencil, Plus, Search, UserRound } from 'lucide-react'
import { Badge, Button } from './ui'
import type { Person } from '../../domain'

type Props = {
  people: Person[]
  selectedIds: Set<string>
  query: string
  collapsed: boolean
  onQueryChange: (value: string) => void
  onToggle: (person: Person) => void
  onAddExternal: () => void
  onSplit: () => void
  onContinue: () => void
  onEdit: () => void
}

export function PeopleSelector({ people, selectedIds, query, collapsed, onQueryChange, onToggle, onAddExternal, onSplit, onContinue, onEdit }: Props) {
  if (collapsed) {
    return <section className="panel panel--compact"><div className="compact-step"><div><span className="section-kicker">PAGANTES</span><h2>{selectedIds.size} {selectedIds.size === 1 ? 'pessoa selecionada' : 'pessoas selecionadas'}</h2></div><div className="compact-step__actions"><Badge tone="success">Etapa concluída</Badge><Button className="button-compact" onClick={onEdit}><Pencil size={15} />Alterar</Button></div></div></section>
  }

  return <section className="panel"><div className="panel-heading"><div><span className="section-kicker">1. PAGANTES</span><h2>Quem vai pagar?</h2><p>Selecione uma ou mais pessoas para dividir a cobrança.</p></div><Button className="button-compact" onClick={onSplit} disabled={!selectedIds.size}>Dividir igualmente</Button></div><label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar envolvido</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar pessoa" /></label><div className="people-grid">{people.length ? people.map((person) => <label className={`person-option ${selectedIds.has(person.id) ? 'is-selected' : ''}`} key={person.id}><input aria-label={`Selecionar ${person.name}`} type="checkbox" checked={selectedIds.has(person.id)} onChange={() => onToggle(person)} /><span className="person-option__avatar"><UserRound size={15} /></span><span><strong>{person.name}</strong><small>{person.role} · {person.email || 'Sem e-mail'}</small></span></label>) : <div className="empty-state"><strong>Nenhuma pessoa encontrada</strong><span>Tente outro nome ou adicione um pagante externo.</span></div>}</div><div className="selection-actions"><Button className="add-external" onClick={onAddExternal}><Plus size={16} />Adicionar externo</Button><Button variant="primary" className="selection-continue" disabled={!selectedIds.size} onClick={onContinue}>Continuar<ChevronRight size={17} /></Button></div></section>
}
