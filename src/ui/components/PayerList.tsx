import { useState } from 'react'
import { Pencil, Users } from 'lucide-react'
import type { Payer } from '../../domain'
import { Badge, Button } from './ui'
import { PayerRow } from './PayerRow'
import { PayerSettingsDialog } from './PayerSettingsDialog'

export function PayerList({ payers, onChange, onEditSelection }: { payers: Payer[]; onChange: (id: string, change: Partial<Payer>) => void; onEditSelection: () => void }) {
  const [activePayerId, setActivePayerId] = useState<string | null>(null)
  const activePayer = payers.find((payer) => payer.id === activePayerId) ?? null

  return <section className="panel payer-review"><div className="panel-heading"><div><span className="section-kicker">2. REVISÃO</span><h2>Pagantes e cobrança</h2><p>Defina o valor aqui. Abra somente quem precisar de configuração.</p></div><div className="payer-list-actions"><Badge tone="info"><Users size={14} /> {payers.length}</Badge><Button className="button-compact" onClick={onEditSelection}><Pencil size={15} />Alterar pagantes</Button></div></div><div className="payer-list payer-list--master">{payers.map((payer) => <PayerRow key={payer.id} payer={payer} onChange={(change) => onChange(payer.id, change)} onConfigure={() => setActivePayerId(payer.id)} />)}</div><PayerSettingsDialog payer={activePayer} onChange={(change) => { if (activePayer) onChange(activePayer.id, change) }} onClose={() => setActivePayerId(null)} /></section>
}
