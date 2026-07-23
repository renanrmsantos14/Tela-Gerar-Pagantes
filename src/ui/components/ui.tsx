import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type MouseEventHandler, type ReactNode } from 'react'
import { MOTION_EASE } from './motion'

type ButtonProps = { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; className?: string; children?: ReactNode; disabled?: boolean; onClick?: MouseEventHandler<HTMLButtonElement>; 'aria-label'?: string; 'aria-busy'?: boolean | 'true' | 'false' }

export function Button({ variant = 'secondary', className = '', children, ...props }: ButtonProps) {
  return <motion.button type="button" className={`ui-button ui-button--${variant} ${className}`.trim()} disabled={props.disabled} aria-label={props['aria-label']} aria-busy={props['aria-busy']} onClick={props.onClick} whileTap={props.disabled ? undefined : { transform: 'scale(.97)' }} transition={{ duration: 0.14, ease: MOTION_EASE }}>{children}</motion.button>
}

export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button {...props} className={`ui-icon-button ${props.className ?? ''}`.trim()} />
}

export function Badge({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'warning' | 'danger' }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div className="ui-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</div>
}

export function Switch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className="ui-switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span className="ui-switch__track" aria-hidden="true"><span /></span><span>{label}</span></label>
}

export function Modal({ open, title, description, onClose, children }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button,input,select,textarea,[href],[tabindex]:not([tabindex="-1"])')].filter((element) => !element.hasAttribute('disabled'))
      if (!focusable.length) return
      const first = focusable[0]; const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('input[autofocus], input, button')?.focus())
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus() }
  }, [open, onClose])
  return <AnimatePresence>{open ? <motion.div className="modal-layer" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: MOTION_EASE }} onMouseDown={onClose}><motion.div ref={dialogRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()} initial={{ opacity: 0, transform: 'translateY(10px) scale(.96)' }} animate={{ opacity: 1, transform: 'translateY(0) scale(1)' }} exit={{ opacity: 0, transform: 'translateY(8px) scale(.985)' }} transition={{ duration: 0.22, ease: MOTION_EASE }}><div className="modal-card__header"><div><h2 id={titleId}>{title}</h2>{description ? <p>{description}</p> : null}</div><IconButton aria-label="Fechar" onClick={onClose}><X size={18} /></IconButton></div>{children}</motion.div></motion.div> : null}</AnimatePresence>
}
