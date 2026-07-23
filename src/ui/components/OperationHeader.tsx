import { RefreshCw, WalletCards, X } from 'lucide-react'
import { Badge, IconButton } from './ui'

export function OperationHeader({ displayId, serviceCount, balanced, onRefresh, onClose }: { displayId: string; serviceCount: number; balanced: boolean; onRefresh: () => void; onClose?: () => void }) {
  return <header className="operation-header"><div className="operation-header__brand"><span className="operation-mark"><WalletCards size={20} /></span><div><span className="eyebrow">GERAR PAGANTES</span><h1>Rateio da {displayId}</h1><p>{serviceCount} serviços vinculados</p></div></div><div className="operation-header__actions"><Badge tone={balanced ? 'success' : 'warning'}>{balanced ? 'Rateio conferido' : 'Revisar rateio'}</Badge><IconButton aria-label="Atualizar dados" onClick={onRefresh}><RefreshCw size={18} /></IconButton>{onClose ? <IconButton aria-label="Fechar" onClick={onClose}><X size={18} /></IconButton> : null}</div></header>
}
