import { CircleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PAYMENT_METHODS, type Payer } from '../../domain'
import { formatCurrency, hasValidCurrencyPrecision, parseCurrency } from '../../money'
import { Badge, Field, Switch } from './ui'

const isCard = (method: number) => method === 202410000
const emailValid = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim())

export function PayerRow({ payer, onChange, invalidAmount, onAmountValidityChange, warning }: { payer: Payer; onChange: (change: Partial<Payer>) => void; invalidAmount?: boolean; onAmountValidityChange?: (invalid: boolean) => void; warning?: string }) {
  const [amountInput, setAmountInput] = useState(() => formatCurrency(payer.amountCents))
  const [editingAmount, setEditingAmount] = useState(false)
  const linkFailed = payer.linkStatus === 'Failed'
  const cardPayment = isCard(payer.paymentMethod)
  const statusBadge = linkFailed ? <Badge tone="danger">Falha no link</Badge> : payer.paymentStatus ? <Badge tone="info">{payer.paymentStatus}</Badge> : null
  const linkLabel = payer.linkStatus === 'Failed' ? 'Link não gerado' : payer.linkStatus === 'Pending' ? 'Processando link' : payer.linkStatus === 'Generated' ? 'Link gerado' : payer.generateLink ? 'Link aguardando' : 'Link não gerado'
  const emailLabel = payer.emailStatus === 'Failed' ? 'E-mail não enviado' : payer.emailStatus === 'Pending' ? 'Processando e-mail' : payer.emailStatus === 'Sent' ? 'E-mail enviado' : payer.sendEmail ? 'E-mail aguardando' : 'E-mail não enviado'
  const setMethod = (paymentMethod: Payer['paymentMethod']) => onChange({ paymentMethod, generateLink: isCard(paymentMethod) ? payer.generateLink : false, sendEmail: isCard(paymentMethod) ? payer.sendEmail : false })
  useEffect(() => { if (!editingAmount) setAmountInput(formatCurrency(payer.amountCents)) }, [editingAmount, payer.amountCents])
  function commitAmount() { setEditingAmount(false); const valid = hasValidCurrencyPrecision(amountInput); const amountCents = parseCurrency(amountInput); if (!valid || amountCents === null) { onAmountValidityChange?.(true); setAmountInput(formatCurrency(payer.amountCents)); return }; onAmountValidityChange?.(false); onChange({ amountCents }); setAmountInput(formatCurrency(amountCents)) }

  return <article className={`payer-list-row ${linkFailed || invalidAmount ? 'payer-list-row--error' : ''}`}><div className="payer-list-row__identity"><div className="payer-list-row__avatar" aria-hidden="true">{payer.name.charAt(0)}</div><div><div className="payer-list-row__name"><strong>{payer.name}</strong>{statusBadge}</div><small>{payer.role} · {payer.email || payer.phone || 'Sem contato cadastrado'}</small>{warning ? <small className="payer-list-row__status">{warning}</small> : null}</div></div><Field label="Forma"><select aria-label={`Forma de cobrança de ${payer.name}`} value={payer.paymentMethod} onChange={(event) => setMethod(Number(event.target.value) as Payer['paymentMethod'])}>{PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></Field><Field label="Valor" inputId={`payer-amount-${payer.id}`} error={invalidAmount ? 'Informe valor em BRL com até 2 casas decimais.' : undefined}><input id={`payer-amount-${payer.id}`} inputMode="decimal" aria-label={`Valor de ${payer.name}`} aria-invalid={invalidAmount || undefined} aria-describedby={invalidAmount ? `payer-amount-${payer.id}-error` : undefined} className={invalidAmount ? 'is-invalid' : undefined} value={amountInput} onFocus={(event) => { setEditingAmount(true); event.currentTarget.select() }} onChange={(event) => setAmountInput(event.target.value)} onBlur={commitAmount} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /></Field><div className="payer-list-row__toggles">{cardPayment ? <><Switch label="Link" checked={payer.generateLink} onChange={(generateLink) => onChange({ generateLink, sendEmail: generateLink ? payer.sendEmail : false })} /><Switch label="E-mail" checked={payer.sendEmail} disabled={!payer.generateLink || !emailValid(payer.email)} onChange={(sendEmail) => onChange({ sendEmail })} /></> : <small>Sem link</small>}<span className={`payer-list-row__status ${linkFailed || payer.emailStatus === 'Failed' ? 'payer-list-row__status--error' : ''}`}><CircleAlert size={14} />{linkLabel} · {emailLabel}</span></div></article>
}
