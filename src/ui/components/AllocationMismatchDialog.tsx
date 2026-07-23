import { AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../../money'
import { Button, Modal } from './ui'

export function AllocationMismatchDialog({ open, operationTotal, allocatedTotal, onClose, onContinue }: { open: boolean; operationTotal: number; allocatedTotal: number; onClose: () => void; onContinue: () => void }) {
  const difference = operationTotal - allocatedTotal
  const direction = difference > 0 ? 'Falta ratear' : 'Excede o total da OP'
  return <Modal open={open} title="Rateio divergente" description="Os valores informados não fecham com o total da OP." onClose={onClose}><div className="allocation-mismatch"><div className="confirm-copy"><AlertTriangle size={22} /><p>Revise os valores antes de gerar os pagantes. Você pode ajustar o rateio ou confirmar o envio mesmo com a diferença.</p></div><dl><div><dt>Total da OP</dt><dd>{formatCurrency(operationTotal)}</dd></div><div><dt>Total dos pagantes</dt><dd>{formatCurrency(allocatedTotal)}</dd></div><div className="allocation-mismatch__difference"><dt>{direction}</dt><dd>{formatCurrency(Math.abs(difference))}</dd></div></dl><div className="modal-actions"><Button variant="primary" onClick={onClose}>Ajustar valores</Button><Button onClick={onContinue}>Continuar mesmo assim</Button></div></div></Modal>
}
