import { AlertTriangle } from 'lucide-react'
import { Button, Modal } from './ui'

export function StatusConfirmationDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Modal open={open} title="Confirmar alteração" description="Existem pagantes com status diferente de Pendente." onClose={onClose}><div className="confirm-copy"><AlertTriangle size={22} /><p>A alteração poderá gerar um novo link ou atualizar o envio. Confirme somente se esse é o resultado esperado.</p></div><div className="modal-actions"><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={onConfirm}>Confirmar alteração</Button></div></Modal>
}
