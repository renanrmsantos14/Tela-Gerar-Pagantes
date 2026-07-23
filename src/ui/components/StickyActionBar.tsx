import { CreditCard, LoaderCircle } from 'lucide-react'
import { Button } from './ui'

export function StickyActionBar({ version, hint, ready, saving, confirm, onSave }: { version: string; hint: string; ready: boolean; saving: boolean; confirm: boolean; onSave: () => void }) {
  return <footer className="sticky-action-bar"><div className="action-meta"><span className={`action-status ${ready ? 'is-ready' : ''}`}>{hint}</span><span className="version">{version}</span></div><Button variant="primary" disabled={!ready || saving} onClick={onSave} aria-busy={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <CreditCard size={18} />}{saving ? 'Gravando...' : confirm ? 'Confirmar alteração' : 'Gerar pagantes'}</Button></footer>
}
