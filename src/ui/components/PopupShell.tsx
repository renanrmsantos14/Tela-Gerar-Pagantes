import type { ReactNode } from 'react'

export function PopupShell({ children }: { children: ReactNode }) {
  return <main className="popup-shell">{children}</main>
}
