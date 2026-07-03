import type { ReactNode } from 'react'
import { ChevronRight, House } from 'lucide-react'

/**
 * Moldura de página do design system: card com breadcrumb,
 * título em League Spartan e área de ações à direita.
 */
export function Shell({
  titulo,
  acoes,
  children,
}: {
  titulo: string
  acoes?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="card-shell">
      <div className="card-top">
        <div className="crumb">
          <House aria-hidden />
          <span>Diário das Obras</span>
          <ChevronRight aria-hidden />
          <span className="cur">{titulo}</span>
        </div>
      </div>
      <div className="card-header">
        <h1 className="card-title">{titulo}</h1>
        <div className="actions">{acoes}</div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}
