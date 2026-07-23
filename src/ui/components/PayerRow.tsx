import { CircleAlert, Link2, Mail, Settings2 } from 'lucide-react'
import type { Payer } from '../../domain'
import { formatCurrency, parseCurrency } from '../../money'
import { Badge, Button, Field } from './ui'

export function PayerRow({ payer, onChange, onConfigure }: { payer: Payer; onChange: (change: Partial<Payer>) => void; onConfigure: () => void }) {
  const linkFailed = payer.linkStatus === 'Failed'
  const delivery = !payer.generateLink ? 'Sem link' : payer.sendEmail ? 'Link e e-mail' : 'Link para compartilhar'
  const statusBadge = linkFailed ? <Badge tone="danger">Falha no link</Badge> : payer.paymentStatus ? <Badge tone="info">{payer.paymentStatus}</Badge> : null

  return <article className={`payer-list-row ${linkFailed ? 'payer-list-row--error' : ''}`}><div className="payer-list-row__identity"><div className="payer-list-row__avatar" aria-hidden="true">{payer.name.charAt(0)}</div><div><div className="payer-list-row__name"><strong>{payer.name}</strong>{statusBadge}</div><small>{payer.role} · {payer.email || payer.phone || 'Sem contato cadastrado'}</small></div></div><Field label="Valor"><input inputMode="decimal" aria-label={`Valor de ${payer.name}`} value={formatCurrency(payer.amountCents)} onChange={(event) => { const cents = parseCurrency(event.target.value); if (cents !== null) onChange({ amountCents: cents }) }} /></Field><div className="payer-list-row__configuration"><span className={linkFailed ? 'payer-list-row__status payer-list-row__status--error' : 'payer-list-row__status'}>{linkFailed ? <CircleAlert size={14} /> : payer.sendEmail ? <Mail size={14} /> : <Link2 size={14} />}{linkFailed ? 'Revisar falha' : delivery}</span><Button className="button-compact" onClick={onConfigure}><Settings2 size={15} />Configurar</Button></div></article>
}
