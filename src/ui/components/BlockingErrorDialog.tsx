import { AlertCircle } from 'lucide-react'
import { Button, Modal } from './ui'

export function BlockingErrorDialog({ message, onClose }: { message: string | null; onClose: () => void }) {
  return <Modal open={Boolean(message)} title="Não foi possível concluir" description="A geração foi interrompida e precisa de atenção." onClose={onClose} className="blocking-error-dialog">
    <div className="blocking-error-copy" role="alert">
      <AlertCircle size={24} aria-hidden="true" />
      <p>{message}</p>
    </div>
    <div className="modal-actions"><Button variant="primary" onClick={onClose}>Entendi, revisar</Button></div>
  </Modal>
}
