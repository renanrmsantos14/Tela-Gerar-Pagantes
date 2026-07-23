import { AlertCircle, CheckCircle2 } from 'lucide-react'

export function FeedbackNotice({ tone, text }: { tone: 'error' | 'success'; text: string }) {
  return <div className={`feedback feedback--${tone}`} role={tone === 'error' ? 'alert' : 'status'}><span aria-hidden="true">{tone === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}</span>{text}</div>
}
