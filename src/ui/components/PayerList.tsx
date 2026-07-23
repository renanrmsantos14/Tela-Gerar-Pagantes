import { Pencil, Users } from 'lucide-react'
import type { Payer } from '../../domain'
import { Badge, Button } from './ui'
import { PayerRow } from './PayerRow'

export function PayerList({ payers, onChange, onEditSelection, invalidAmountIds, warnings, onAmountValidityChange }: { payers: Payer[]; onChange: (id: string, change: Partial<Payer>) => void; onEditSelection: () => void; invalidAmountIds: Set<string>; warnings: Map<string, string>; onAmountValidityChange: (id: string, invalid: boolean) => void }) {
  return <section className="panel payer-review"><div className="panel-heading"><div><span className="section-kicker">2. REVISÃO</span><h2>Pagantes e cobrança</h2><p>Defina a cobrança de cada pagante em uma única linha.</p></div><div className="payer-list-actions"><Badge tone="info"><Users size={14} /> {payers.length}</Badge><Button className="button-compact" onClick={onEditSelection}><Pencil size={15} />Alterar pagantes</Button></div></div><div className="payer-list payer-list--master">{payers.map((payer) => <PayerRow key={payer.id} payer={payer} invalidAmount={invalidAmountIds.has(payer.id)} warning={warnings.get(payer.id)} onAmountValidityChange={(invalid) => onAmountValidityChange(payer.id, invalid)} onChange={(change) => onChange(payer.id, change)} />)}</div></section>
}
