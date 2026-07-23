import { Search, UserRoundPlus } from 'lucide-react'
import type { Person } from '../../domain'
import { Button, Modal } from './ui'

export function ExternalPayerDialog({ open, people, selectedIds, query, onQueryChange, onClose, onSelect }: { open: boolean; people: Person[]; selectedIds: Set<string>; query: string; onQueryChange: (value: string) => void; onClose: () => void; onSelect: (person: Person) => void }) {
  const normalized = query.toLocaleLowerCase('pt-BR')
  const filtered = people.filter((person) => `${person.name} ${person.email}`.toLocaleLowerCase('pt-BR').includes(normalized)).slice(0, 30)
  return <Modal open={open} title="Adicionar pagante externo" description="Busque uma pessoa no Banco de Dados." onClose={onClose}><label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar pessoa</span><input autoFocus value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Nome ou e-mail" /></label><div className="directory-list">{filtered.map((person) => <Button key={person.id} className="directory-option" disabled={selectedIds.has(person.id)} onClick={() => onSelect(person)}><span><strong>{person.name}</strong><small>{person.email || 'Sem e-mail'}</small></span><span>{selectedIds.has(person.id) ? 'Já selecionado' : <><UserRoundPlus size={15} /> Adicionar</>}</span></Button>)}</div></Modal>
}
