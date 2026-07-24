import { LoaderCircle, Search, UserRoundPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Person, PersonSearch } from '../../domain'
import { Button, Modal } from './ui'

export function ExternalPayerDialog({
  open,
  selectedIds,
  query,
  onQueryChange,
  onClose,
  onSelect,
  onSearch
}: {
  open: boolean
  selectedIds: Set<string>
  query: string
  onQueryChange: (value: string) => void
  onClose: () => void
  onSelect: (person: Person) => void
  onSearch: PersonSearch
}) {
  const [results, setResults] = useState<Person[]>([])
  const [nextLink, setNextLink] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  useEffect(() => {
    const currentRequest = ++requestId.current
    if (!open || query.trim().length < 2) {
      setResults([])
      setNextLink(undefined)
      setError('')
      setLoading(false)
      return
    }
    setResults([])
    setNextLink(undefined)
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const page = await onSearch(query)
        if (currentRequest !== requestId.current) return
        setResults(page.people)
        setNextLink(page.nextLink)
      } catch {
        if (currentRequest === requestId.current) setError('Não foi possível pesquisar o cadastro.')
      } finally {
        if (currentRequest === requestId.current) setLoading(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [open, onSearch, query])

  async function loadMore() {
    if (!nextLink || loading) return
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const page = await onSearch(query, nextLink)
      if (currentRequest !== requestId.current) return
      setResults((current) => [...current, ...page.people.filter((person) => !current.some((item) => item.id === person.id))])
      setNextLink(page.nextLink)
    } catch {
      if (currentRequest === requestId.current) setError('Não foi possível carregar mais resultados.')
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }

  return <Modal open={open} title="Adicionar pagante externo" description="Pesquise no cadastro por nome ou e-mail." onClose={onClose}>
    <label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar pessoa</span><input autoFocus value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Nome ou e-mail" /></label>
    <div className="directory-list">
      {query.trim().length < 2 ? <div className="empty-state"><strong>Digite pelo menos 2 caracteres</strong><span>A busca consulta o cadastro conforme você digita.</span></div> : null}
      {loading && !results.length ? <div className="empty-state"><LoaderCircle className="spin" size={18} /><strong>Pesquisando...</strong></div> : null}
      {error ? <div className="empty-state" role="alert"><strong>{error}</strong><span>Tente novamente.</span></div> : null}
      {!loading && !error && query.trim().length >= 2 && !results.length ? <div className="empty-state"><strong>Nenhuma pessoa encontrada</strong><span>Revise o nome ou e-mail pesquisado.</span></div> : null}
      {results.map((person) => <Button key={person.id} className="directory-option" disabled={selectedIds.has(person.id)} onClick={() => onSelect(person)}>
        <span><strong>{person.name}</strong><small>{person.email || 'Sem e-mail'}</small></span>
        <span>{selectedIds.has(person.id) ? 'Já selecionado' : <><UserRoundPlus size={15} /> Adicionar</>}</span>
      </Button>)}
      {nextLink ? <Button className="recipient-search__more" disabled={loading} onClick={() => void loadMore()}>{loading ? 'Carregando...' : 'Carregar mais'}</Button> : null}
    </div>
  </Modal>
}
