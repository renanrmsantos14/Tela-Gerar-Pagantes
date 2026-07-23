import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { MOTION_EASE } from './motion'

export function PopupShell({ children }: { children: ReactNode }) {
  return <motion.main className="popup-shell" initial={{ opacity: 0, transform: 'translateY(10px) scale(.97)' }} animate={{ opacity: 1, transform: 'translateY(0) scale(1)' }} transition={{ duration: 0.22, ease: MOTION_EASE }}>{children}</motion.main>
}
