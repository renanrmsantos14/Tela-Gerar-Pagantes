import { AnimatePresence, motion } from 'motion/react'
import type { Payer } from '../../domain'
import { PAYMENT_METHODS } from '../../domain'
import { formatCurrency, parseCurrency } from '../../money'
import { Field, Switch, Badge } from './ui'
import { MOTION_EASE } from './motion'

const isCard = (method: number) => method === 202410000

export function PayerRow({ payer, onChange }: { payer: Payer; onChange: (change: Partial<Payer>) => void }) {
  return <motion.article className="payer-row" layout initial={{ opacity: 0, transform: 'translateY(8px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0, transform: 'translateY(-6px)' }} transition={{ duration: 0.18, ease: MOTION_EASE }}><div className="payer-identity"><div className="payer-identity__top"><strong>{payer.name}</strong><Badge tone={payer.existingPayerId ? 'info' : 'success'}>{payer.paymentStatus ?? 'Novo pagante'}</Badge></div><small>{payer.role} · {payer.email || 'Sem e-mail'}</small></div><Field label="Valor"><input aria-label={`Valor de ${payer.name}`} value={formatCurrency(payer.amountCents)} onChange={(event) => { const cents = parseCurrency(event.target.value); if (cents !== null) onChange({ amountCents: cents }) }} /></Field><Field label="Forma"><select value={payer.paymentMethod} onChange={(event) => { const method = Number(event.target.value) as Payer['paymentMethod']; onChange({ paymentMethod: method, generateLink: isCard(method) ? payer.generateLink : false, sendEmail: isCard(method) ? payer.sendEmail : false }) }}>{PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></Field><div className="payer-options"><Switch label="Gerar link" checked={payer.generateLink} disabled={!isCard(payer.paymentMethod)} onChange={(checked) => onChange({ generateLink: checked, sendEmail: checked ? payer.sendEmail : false })} /><Switch label="Enviar e-mail" checked={payer.sendEmail} disabled={!payer.generateLink} onChange={(checked) => onChange({ sendEmail: checked })} /></div><AnimatePresence initial={false}>{payer.paymentUrl ? <motion.a className="payer-link" href={payer.paymentUrl} target="_blank" rel="noreferrer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Abrir link</motion.a> : null}</AnimatePresence></motion.article>
}
