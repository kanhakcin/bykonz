import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bell,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Waves,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth, useTheme, useToast } from '../providers'
import type { Tema } from '../providers'

const MODULOS: { rota: string; rotulo: string; icone: LucideIcon }[] = [
  { rota: '/painel', rotulo: 'Painel', icone: LayoutDashboard },
  { rota: '/cadastros', rotulo: 'Cadastros', icone: ClipboardList },
  { rota: '/relatorios', rotulo: 'Relatórios', icone: FileText },
]

const ICONE_TEMA: Record<Tema, LucideIcon> = {
  light: Sun,
  dark: Moon,
  'ocean-blue': Waves,
}

export function Sidebar() {
  const [colapsada, setColapsada] = useState(false)
  const { tema, alternarTema } = useTheme()
  const { usuario, sair } = useAuth()
  const toast = useToast()
  const IconeTema = ICONE_TEMA[tema]

  return (
    <aside className={`sidebar${colapsada ? ' collapsed' : ''}`}>
      <div className="sb-panel">
        <div className="sb-head">
          <div className="sb-logo">
            <img src="/brand/logo-icon.png" alt="" />
            {!colapsada && (
              <div>
                <div className="name">Diário das Obras</div>
                <span className="sub">Painel do gestor</span>
              </div>
            )}
          </div>
          <div className="sb-actions">
            <button type="button" onClick={alternarTema} title={`Tema: ${tema}`} aria-label="Alternar tema">
              <IconeTema size={16} />
            </button>
            {!colapsada && (
              <button type="button" onClick={() => toast('Sem notificações novas')} aria-label="Notificações">
                <Bell size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setColapsada((c) => !c)}
              aria-label={colapsada ? 'Expandir menu' : 'Recolher menu'}
            >
              {colapsada ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
        </div>

        <nav className="sb-nav">
          {MODULOS.map(({ rota, rotulo, icone: Icone }) => (
            <NavLink
              key={rota}
              to={rota}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title={rotulo}
            >
              <Icone size={16} />
              {!colapsada && rotulo}
            </NavLink>
          ))}
        </nav>

        <div className="sb-foot">
          <div className="sb-user">
            <span className="av">{usuario?.initials ?? '—'}</span>
            {!colapsada && (
              <>
                <div>
                  <div className="nm">{usuario?.name}</div>
                  <div className="rl">{usuario?.role}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  style={{ marginLeft: 'auto' }}
                  onClick={sair}
                  aria-label="Sair"
                  title="Sair"
                >
                  <LogOut size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
