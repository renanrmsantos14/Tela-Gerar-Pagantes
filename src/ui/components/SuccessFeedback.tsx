import { Check } from 'lucide-react'

export function SuccessFeedback({ text }: { text: string }) {
  return <div className="success-feedback" role="status" aria-live="assertive"><div className="success-feedback__card"><span className="success-feedback__icon" aria-hidden="true"><Check size={30} strokeWidth={2.5} /></span><strong>Pagantes gerados</strong><p>{text}</p><span className="success-feedback__hint">Esta tela será fechada automaticamente.</span></div></div>
}
