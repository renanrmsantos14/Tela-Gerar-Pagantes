import { AlertTriangle } from 'lucide-react'
import type { Payer } from '../../domain'
import { Button, Modal } from './ui'

const paymentMethodLabel = (payer: Payer) => payer.paymentMethod === 202410001 ? 'Pedido de compra' : payer.paymentMethod === 202410002 ? 'Pix' : 'Cartão de crédito'

export function ExistingPayersDialog({ payers, open, onReview, onReplace }: { payers: Payer[]; open: boolean; onReview: () => void; onReplace: () => void }) {
  return <Modal open={open} title="Pagantes já gerados" description="Não foi possível gerar porque já existem pagantes para esta OP." onClose={onReview} className="existing-payers-dialog">
    <div className="confirm-copy"><AlertTriangle size={22} aria-hidden="true" /><p>Revise os registros atuais ou substitua todos por esta nova configuração.</p></div>
    <div className="existing-payers-list" aria-label="Pagantes existentes">
      {payers.map((payer) => <div className="existing-payer-item" key={payer.existingPayerId ?? payer.id}><strong>{payer.name}</strong><span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payer.amountCents / 100)} · {paymentMethodLabel(payer)}</span></div>)}
    </div>
    <div className="modal-actions"><Button variant="primary" onClick={onReview}>Revisar</Button><Button variant="secondary" onClick={onReplace}>Substituir</Button></div>
  </Modal>
}
