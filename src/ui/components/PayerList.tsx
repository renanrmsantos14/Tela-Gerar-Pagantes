import { AnimatePresence } from 'motion/react'
import { Users } from 'lucide-react'
import type { Payer } from '../../domain'
import { Badge } from './ui'
import { PayerRow } from './PayerRow'

export function PayerList({ payers, onChange }: { payers: Payer[]; onChange: (id: string, change: Partial<Payer>) => void }) {
  return <section className="panel"><div className="panel-heading"><div><span className="section-kicker">COBRANÇA</span><h2>Pagantes selecionados</h2><p>Revise valores, forma e envio antes de gerar.</p></div><Badge tone="info"><Users size={14} /> {payers.length}</Badge></div>{payers.length ? <div className="payer-list"><AnimatePresence initial={false}>{payers.map((payer) => <PayerRow key={payer.id} payer={payer} onChange={(change) => onChange(payer.id, change)} />)}</AnimatePresence></div> : <div className="empty-state"><Users size={30} /><strong>Nenhum pagante selecionado</strong><span>Selecione um envolvido acima para iniciar o rateio.</span></div>}</section>
}
