import { CircleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PAYMENT_METHODS, type Payer } from '../../domain'
import { formatCurrency, parseCurrency } from '../../money'
import { Badge, Field, Switch } from './ui'

const isCard = (method: number) => method === 202410000
const emailValid = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim())

export function PayerRow({ payer, onChange }: { payer: Payer; onChange: (change: Partial<Payer>) => void }) {
  const [amountInput, setAmountInput] = useState(() => formatCurrency(payer.amountCents))
  const [editingAmount, setEditingAmount] = useState(false)
  const linkFailed = payer.linkStatus === 'Failed'
  const cardPayment = isCard(payer.paymentMethod)
  const statusBadge = linkFailed ? <Badge tone="danger">Falha no link</Badge> : payer.paymentStatus ? <Badge tone="info">{payer.paymentStatus}</Badge> : null
  const setMethod = (paymentMethod: Payer['paymentMethod']) => onChange({ paymentMethod, generateLink: isCard(paymentMethod) ? payer.generateLink : false, sendEmail: isCard(paymentMethod) ? payer.sendEmail : false })
  useEffect(() => { if (!editingAmount) setAmountInput(formatCurrency(payer.amountCents)) }, [editingAmount, payer.amountCents])
  function commitAmount() { setEditingAmount(false); const amountCents = parseCurrency(amountInput); if (amountCents === null) { setAmountInput(formatCurrency(payer.amountCents)); return }; onChange({ amountCents }); setAmountInput(formatCurrency(amountCents)) }

  return <article className={`payer-list-row ${linkFailed ? 'payer-list-row--error' : ''}`}><div className="payer-list-row__identity"><div className="payer-list-row__avatar" aria-hidden="true">{payer.name.charAt(0)}</div><div><div className="payer-list-row__name"><strong>{payer.name}</strong>{statusBadge}</div><small>{payer.role} · {payer.email || payer.phone || 'Sem contato cadastrado'}</small></div></div><Field label="Forma"><select aria-label={`Forma de cobrança de ${payer.name}`} value={payer.paymentMethod} onChange={(event) => setMethod(Number(event.target.value) as Payer['paymentMethod'])}>{PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></Field><Field label="Valor"><input inputMode="decimal" aria-label={`Valor de ${payer.name}`} value={amountInput} onFocus={(event) => { setEditingAmount(true); event.currentTarget.select() }} onChange={(event) => setAmountInput(event.target.value)} onBlur={commitAmount} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /></Field><div className="payer-list-row__toggles">{cardPayment ? <><Switch label="Link" checked={payer.generateLink} onChange={(generateLink) => onChange({ generateLink, sendEmail: generateLink ? payer.sendEmail : false })} /><Switch label="E-mail" checked={payer.sendEmail} disabled={!payer.generateLink || !emailValid(payer.email)} onChange={(sendEmail) => onChange({ sendEmail })} /></> : <small>Sem link</small>}{linkFailed ? <span className="payer-list-row__status payer-list-row__status--error"><CircleAlert size={14} />Revisar falha</span> : null}</div></article>
}
