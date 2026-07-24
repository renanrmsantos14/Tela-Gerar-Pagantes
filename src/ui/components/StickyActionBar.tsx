import { CreditCard, LoaderCircle } from 'lucide-react'
import { Button } from './ui'

export function StickyActionBar({ version, hint, ready, saving, completed, onSave }: { version: string; hint: string; ready: boolean; saving: boolean; completed: boolean; onSave: () => void }) {
  return <footer className="sticky-action-bar">
    <div className="action-meta"><span className={`action-status ${ready ? 'is-ready' : ''}`}>{hint}</span><span className="version">{version}</span></div>
    <Button variant="primary" className={ready ? '' : 'is-unavailable'} disabled={saving || completed} aria-disabled={!ready || saving || completed} onClick={onSave} aria-busy={saving}>
      {saving ? <LoaderCircle className="spin" size={18} /> : <CreditCard size={18} />}
      {saving ? 'Processando...' : completed ? 'Pagantes gerados' : 'Gerar pagantes'}
    </Button>
  </footer>
}
