import { Pencil, Users } from 'lucide-react'
import type { Payer } from '../../domain'
import { Badge, Button } from './ui'
import { PayerRow } from './PayerRow'

export function PayerList({ payers, onChange, onEditSelection }: { payers: Payer[]; onChange: (id: string, change: Partial<Payer>) => void; onEditSelection: () => void }) {
  return <section className="panel payer-review"><div className="panel-heading"><div><span className="section-kicker">2. REVISÃO</span><h2>Configurar cobrança</h2><p>Valor, forma de pagamento e envio.</p></div><div className="payer-list-actions"><Badge tone="info"><Users size={14} /> {payers.length}</Badge><Button className="button-compact" onClick={onEditSelection}><Pencil size={15} />Alterar pagantes</Button></div></div><div className="payer-review-table"><div className="payer-review-table__head" aria-hidden="true"><span>Pagante</span><span>Contato</span><span>Forma</span><span>Valor</span><span>Link</span></div><div className="payer-list">{payers.map((payer) => <PayerRow key={payer.id} payer={payer} onChange={(change) => onChange(payer.id, change)} />)}</div></div></section>
}
