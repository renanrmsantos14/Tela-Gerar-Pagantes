import { AnimatePresence } from 'motion/react'
import { Pencil, Users } from 'lucide-react'
import type { Payer } from '../../domain'
import { Badge, Button } from './ui'
import { PayerRow } from './PayerRow'

export function PayerList({ payers, onChange, onEditSelection }: { payers: Payer[]; onChange: (id: string, change: Partial<Payer>) => void; onEditSelection: () => void }) {
  return <section className="panel"><div className="panel-heading"><div><span className="section-kicker">2. REVISÃO</span><h2>Valores e envio</h2><p>Confira o rateio antes de gerar.</p></div><div className="payer-list-actions"><Badge tone="info"><Users size={14} /> {payers.length}</Badge><Button className="button-compact" onClick={onEditSelection}><Pencil size={15} />Pagantes</Button></div></div><div className="payer-list"><AnimatePresence initial={false}>{payers.map((payer) => <PayerRow key={payer.id} payer={payer} onChange={(change) => onChange(payer.id, change)} />)}</AnimatePresence></div></section>
}
