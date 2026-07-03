/**
 * Providers de aplicação: tema (light / dark / ocean-blue), sessão do gestor
 * e toast de feedback.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { api } from './api/client'
import { clearToken } from './api/http'
import type { User } from './api/types'

/* ---- Tema ---- */

export const TEMAS = ['light', 'dark', 'ocean-blue'] as const
export type Tema = (typeof TEMAS)[number]

const ThemeContext = createContext<{ tema: Tema; alternarTema: () => void }>({
  tema: 'light',
  alternarTema: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    const salvo = localStorage.getItem('diario.tema')
    return TEMAS.includes(salvo as Tema) ? (salvo as Tema) : 'light'
  })

  useEffect(() => {
    const el = document.documentElement
    el.classList.remove(...TEMAS)
    el.classList.add(tema)
    localStorage.setItem('diario.tema', tema)
  }, [tema])

  const alternarTema = useCallback(() => {
    setTema((atual) => TEMAS[(TEMAS.indexOf(atual) + 1) % TEMAS.length])
  }, [])

  return <ThemeContext.Provider value={{ tema, alternarTema }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

/* ---- Sessão ---- */

interface AuthContexto {
  usuario: User | null
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => void
}

const AuthContext = createContext<AuthContexto>({
  usuario: null,
  entrar: async () => {},
  sair: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(() => {
    const salvo = localStorage.getItem('diario.usuario')
    return salvo ? (JSON.parse(salvo) as User) : null
  })

  const entrar = useCallback(async (email: string, senha: string) => {
    const logado = await api.login(email, senha)
    localStorage.setItem('diario.usuario', JSON.stringify(logado))
    setUsuario(logado)
  }, [])

  const sair = useCallback(() => {
    localStorage.removeItem('diario.usuario')
    clearToken()
    setUsuario(null)
  }, [])

  return <AuthContext.Provider value={{ usuario, entrar, sair }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

/* ---- Toast ---- */

const ToastContext = createContext<(mensagem: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [mensagem, setMensagem] = useState('')
  const [visivel, setVisivel] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const mostrar = useCallback((texto: string) => {
    setMensagem(texto)
    setVisivel(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisivel(false), 1900)
  }, [])

  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      <div className={`toast${visivel ? ' show' : ''}`} role="status" aria-live="polite">
        <Check aria-hidden />
        <span>{mensagem}</span>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
