import { ArrowLeft, Check, LoaderCircle, Mail, Pencil, ReceiptText, Search, UserRoundPlus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Payer, Person, PersonSearch } from '../../domain'
import { Button } from './ui'

const emailValid = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim())

function recipientFor(payer: Payer, people: Person[]): Person {
  return people.find((person) => person.id === (payer.recipientId ?? payer.id))
    ?? { id: payer.recipientId ?? payer.id, name: payer.recipientName ?? payer.name, email: payer.recipientEmail ?? payer.email, phone: payer.phone, role: payer.role }
}

export function RecipientConfirmation({
  payers,
  people,
  onChange,
  onBack,
  onSearchDirectory
}: {
  payers: Payer[]
  people: Person[]
  onChange: (payerId: string, recipient: Person) => void
  onBack: () => void
  onSearchDirectory?: PersonSearch
}) {
  const [searchingFor, setSearchingFor] = useState<string | null>(null)
  const [directoryMode, setDirectoryMode] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [nextLink, setNextLink] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const requestId = useRef(0)
  const eligible = payers.filter((payer) => payer.generateLink && payer.sendEmail)
  const localChoices = useMemo(() => {
    const normalized = query.toLocaleLowerCase('pt-BR')
    return people.filter((person) => `${person.name} ${person.email} ${person.role}`.toLocaleLowerCase('pt-BR').includes(normalized))
  }, [people, query])

  useEffect(() => {
    if (!directoryMode || !onSearchDirectory || query.trim().length < 2) {
      setResults([])
      setNextLink(undefined)
      setSearchError('')
      setLoading(false)
      return
    }
    const currentRequest = ++requestId.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setSearchError('')
      try {
        const page = await onSearchDirectory(query)
        if (currentRequest !== requestId.current) return
        setResults(page.people)
        setNextLink(page.nextLink)
      } catch {
        if (currentRequest === requestId.current) setSearchError('Não foi possível pesquisar o cadastro.')
      } finally {
        if (currentRequest === requestId.current) setLoading(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [directoryMode, onSearchDirectory, query])

  function resetSearch() {
    requestId.current += 1
    setSearchingFor(null)
    setDirectoryMode(false)
    setQuery('')
    setResults([])
    setNextLink(undefined)
    setSearchError('')
  }

  async function loadMore() {
    if (!onSearchDirectory || !nextLink || loading) return
    setLoading(true)
    try {
      const page = await onSearchDirectory(query, nextLink)
      setResults((current) => [...current, ...page.people.filter((person) => !current.some((item) => item.id === person.id))])
      setNextLink(page.nextLink)
    } catch {
      setSearchError('Não foi possível carregar mais resultados.')
    } finally {
      setLoading(false)
    }
  }

  return <section className="panel recipient-confirmation">
    <div className="recipient-confirmation__header">
      <div><span className="section-kicker">3. DESTINATÁRIOS</span><h2>Confirme o destinatário do e-mail</h2></div>
      <Button variant="ghost" className="button-compact recipient-confirmation__back" onClick={onBack}><ArrowLeft size={15} />Revisão</Button>
    </div>
    <div className="recipient-confirmation__list">
      {eligible.map((payer) => {
        const recipient = recipientFor(payer, people)
        const isSearching = searchingFor === payer.id
        const validRecipient = emailValid(recipient.email)
        const choices = directoryMode ? results : localChoices
        return <article className={`recipient-card ${validRecipient ? '' : 'recipient-card--error'}`} key={payer.id}>
          <div className="recipient-card__receipt"><ReceiptText size={17} aria-hidden="true" /><span>Recibo em nome de <strong>{payer.name}</strong></span></div>
          <div className="recipient-card__current">
            <div className="recipient-card__mail-icon" aria-hidden="true"><Mail size={18} /></div>
            <div className="recipient-card__identity"><span>DESTINATÁRIO</span><strong>{recipient.name}</strong><small>{recipient.email || 'Sem e-mail cadastrado'}</small></div>
            <Button variant="ghost" className="recipient-card__change" aria-label={`Alterar destinatário de ${payer.name}`} aria-expanded={isSearching} onClick={() => {
              if (isSearching) resetSearch()
              else {
                setSearchingFor(payer.id)
                setDirectoryMode(false)
                setQuery('')
              }
            }}><Pencil size={15} />{isSearching ? 'Fechar' : 'Alterar'}</Button>
          </div>
          {!validRecipient ? <p className="recipient-card__error" role="alert">Escolha uma pessoa com e-mail cadastrado.</p> : null}
          {isSearching ? <div className="recipient-search">
            <div className="recipient-search__toolbar">
              {directoryMode ? <Button variant="ghost" className="recipient-search__scope" onClick={() => { setDirectoryMode(false); setQuery(''); setResults([]) }}><ArrowLeft size={14} />Pessoas da OP</Button> : null}
              <label className="search-field">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Buscar destinatário para {payer.name}</span>
                <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={directoryMode ? 'Buscar no cadastro por nome ou e-mail' : 'Buscar nesta OP'} />
              </label>
            </div>
            <fieldset className="recipient-options">
              <legend className="sr-only">Escolha o destinatário de {payer.name}</legend>
              {directoryMode && query.trim().length < 2 ? <p className="recipient-search__empty">Digite pelo menos 2 caracteres.</p> : null}
              {loading && !results.length ? <p className="recipient-search__empty recipient-search__loading"><LoaderCircle size={15} />Pesquisando...</p> : null}
              {searchError ? <p className="recipient-search__error" role="alert">{searchError}</p> : null}
              {!loading && !searchError && (!directoryMode || query.trim().length >= 2) && !choices.length ? <p className="recipient-search__empty">Nenhuma pessoa encontrada.</p> : null}
              {choices.map((person) => {
                const selected = recipient.id === person.id
                const valid = emailValid(person.email)
                return <label className={`recipient-option ${selected ? 'is-selected' : ''} ${valid ? '' : 'is-disabled'}`} key={person.id}>
                  <input type="radio" name={`recipient-${payer.id}`} checked={selected} disabled={!valid} onChange={() => { onChange(payer.id, person); resetSearch() }} />
                  <span className="recipient-option__avatar" aria-hidden="true">{person.name.charAt(0)}</span>
                  <span className="recipient-option__identity"><strong>{person.name}</strong><small>{person.role} · {person.email || 'Sem e-mail cadastrado'}</small></span>
                  {selected ? <Check size={17} aria-hidden="true" /> : null}
                </label>
              })}
            </fieldset>
            {!directoryMode && onSearchDirectory ? <Button variant="ghost" className="recipient-search__directory" onClick={() => { setDirectoryMode(true); setQuery(''); setResults([]) }}><UserRoundPlus size={16} />Adicionar do cadastro</Button> : null}
            {directoryMode && nextLink ? <Button className="recipient-search__more" disabled={loading} onClick={() => void loadMore()}>{loading ? 'Carregando...' : 'Carregar mais'}</Button> : null}
          </div> : null}
        </article>
      })}
    </div>
  </section>
}
