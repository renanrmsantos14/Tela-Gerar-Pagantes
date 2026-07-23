import { Check, Mail, Search, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Payer, Person } from '../../domain'
import { Badge, Button } from './ui'

const emailValid = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim())

function recipientFor(payer: Payer): Person {
  return { id: payer.recipientId ?? payer.id, name: payer.recipientName ?? payer.name, email: payer.recipientEmail ?? payer.email, phone: payer.phone, role: payer.recipientId ? 'Adicionado' : payer.role }
}

export function RecipientConfirmation({ payers, people, onChange, onBack }: { payers: Payer[]; people: Person[]; onChange: (payerId: string, recipient: Person) => void; onBack: () => void }) {
  const [searchingFor, setSearchingFor] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const eligible = payers.filter((payer) => payer.generateLink && payer.sendEmail)
  const choices = useMemo(() => people.filter((person) => `${person.name} ${person.email} ${person.role}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))), [people, query])

  return <section className="panel recipient-confirmation"><div className="panel-heading"><div><span className="section-kicker">3. DESTINATÁRIOS</span><h2>Para quem enviar?</h2><p>O link e recibo continuam no nome do pagante.</p></div><Button className="button-compact" onClick={onBack}>Voltar à revisão</Button></div><div className="recipient-confirmation__list">{eligible.map((payer) => { const recipient = recipientFor(payer); const isSearching = searchingFor === payer.id; const isOwnEmail = recipient.id === payer.id; return <article className="recipient-card" key={payer.id}><div className="recipient-card__summary"><div><span>RECIBO</span><strong>Link e recibo em nome de {payer.name}</strong></div><Badge tone={emailValid(recipient.email) ? 'success' : 'danger'}>{emailValid(recipient.email) ? 'E-mail válido' : 'Sem e-mail válido'}</Badge></div><div className="recipient-card__delivery"><Mail size={18} aria-hidden="true" /><div><span>ENVIAR PARA</span><strong>{recipient.name}</strong><small>{recipient.email || 'E-mail não cadastrado'}</small></div></div><div className="recipient-card__actions"><Button variant={isOwnEmail ? 'primary' : 'secondary'} onClick={() => { onChange(payer.id, payer); setSearchingFor(null); setQuery('') }}><Check size={16} />Mesmo e-mail</Button><Button variant={isSearching ? 'primary' : 'secondary'} onClick={() => { setSearchingFor(isSearching ? null : payer.id); setQuery('') }}><Search size={16} />Outra pessoa</Button></div>{isSearching ? <div className="recipient-search"><label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar destinatário para {payer.name}</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar solicitante ou passageiro" /></label><div className="recipient-search__choices">{choices.length ? choices.map((person) => <Button key={person.id} className="recipient-choice" disabled={!emailValid(person.email)} onClick={() => { onChange(payer.id, person); setSearchingFor(null); setQuery('') }}><UserRound size={16} /><span><strong>{person.name}</strong><small>{person.role} · {person.email || 'Sem e-mail'}</small></span></Button>) : <small>Nenhuma pessoa da OP encontrada.</small>}</div></div> : null}</article>})}</div></section>
}
