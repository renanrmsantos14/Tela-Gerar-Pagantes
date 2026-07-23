import { Check, CreditCard, Link2 } from 'lucide-react'
import { PAYMENT_METHODS, type Payer } from '../../domain'
import { formatCurrency } from '../../money'
import { Button, Field, Modal, Switch } from './ui'

const isCard = (method: number) => method === 202410000
const emailValid = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim())

export function PayerSettingsDialog({ payer, onChange, onClose }: { payer: Payer | null; onChange: (change: Partial<Payer>) => void; onClose: () => void }) {
  if (!payer) return null
  const cardPayment = isCard(payer.paymentMethod)
  const emailError = payer.sendEmail && !emailValid(payer.email)
  const changeMethod = (method: Payer['paymentMethod']) => onChange({ paymentMethod: method, generateLink: isCard(method) ? payer.generateLink : false, sendEmail: isCard(method) ? payer.sendEmail : false })

  return <Modal open title={`Cobrança de ${payer.name}`} description="Configure somente o que este pagante precisa receber." onClose={onClose} className="modal-card--payer-settings"><div className="payer-settings"><div className="payer-settings__amount"><span>Valor definido</span><strong>{formatCurrency(payer.amountCents)}</strong></div><fieldset className="payer-settings__methods"><legend>Forma de cobrança</legend>{PAYMENT_METHODS.map((method) => <button type="button" key={method.value} className={`payer-settings__method ${payer.paymentMethod === method.value ? 'is-selected' : ''}`} onClick={() => changeMethod(method.value)}><span>{method.label}</span>{payer.paymentMethod === method.value ? <Check size={17} aria-label="Selecionado" /> : null}</button>)}</fieldset>{cardPayment ? <section className="payer-settings__delivery"><div className="payer-settings__delivery-title"><CreditCard size={17} /><span>Link de pagamento</span></div><Switch label="Gerar link de pagamento" checked={payer.generateLink} onChange={(generateLink) => onChange({ generateLink, sendEmail: generateLink ? payer.sendEmail : false })} />{payer.generateLink ? <div className="payer-settings__email"><Switch label="Enviar link por e-mail" checked={payer.sendEmail} onChange={(sendEmail) => onChange({ sendEmail })} />{payer.sendEmail ? <Field label="E-mail do recebedor" hint={emailError ? 'Informe um e-mail válido para enviar o link.' : undefined}><input autoFocus type="email" aria-invalid={emailError} className={emailError ? 'is-invalid' : ''} value={payer.email} onChange={(event) => onChange({ email: event.target.value })} placeholder="nome@empresa.com.br" /></Field> : <p><Link2 size={15} />O link será gerado para copiar e compartilhar.</p>}</div> : null}</section> : <p className="payer-settings__info">Esta forma não gera link de pagamento.</p>}{payer.linkStatus === 'Failed' ? <p className="payer-settings__error" role="alert">{payer.linkError || 'Revise o histórico do Flow antes de gerar novamente.'}</p> : null}{payer.paymentUrl ? <a className="payer-settings__url" href={payer.paymentUrl} target="_blank" rel="noreferrer">Abrir link já gerado</a> : null}<div className="payer-settings__footer"><Button variant="primary" onClick={onClose}>Concluir</Button></div></div></Modal>
}
