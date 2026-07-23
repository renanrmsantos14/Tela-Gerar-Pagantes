import { CheckCircle2, CircleAlert } from 'lucide-react'
import { formatCurrency } from '../../money'

export function AllocationSummary({ totalCents, allocatedCents, remainingCents }: { totalCents: number; allocatedCents: number; remainingCents: number }) {
  const balanced = remainingCents === 0
  return <section className={`allocation-summary ${balanced ? 'is-balanced' : 'is-pending'}`} aria-label="Resumo do rateio"><div><span>Valor da OP</span><strong>{formatCurrency(totalCents)}</strong></div><div><span>Rateado</span><strong>{formatCurrency(allocatedCents)}</strong></div><div className="allocation-summary__state">{balanced ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}<span>{balanced ? 'Total conferido' : 'Restante'}</span><strong>{balanced ? 'Exato' : formatCurrency(Math.abs(remainingCents))}</strong></div></section>
}
