import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Lock, Mail } from 'lucide-react'
import { Button, Field } from '../components/ui'
import { useAuth } from '../providers'

export function Login() {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(false)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro(false)
    try {
      await entrar(email, senha)
    } catch {
      setErro(true)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-form-col">
        <form className="login-card" onSubmit={aoEnviar}>
          <div className="login-brand">
            <img src="/brand/logo-icon.png" alt="Diário das Obras" />
            <span className="sub" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
              Diário das Obras
            </span>
          </div>
          <div>
            <h1 className="login-title">Bem-vindo de volta</h1>
            <p className="login-sub">Entre na sua conta para continuar</p>
          </div>
          <Field
            id="email"
            label="E-mail"
            type="email"
            icon={Mail}
            placeholder="voce@empresa.com.br"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            id="senha"
            label="Senha"
            type="password"
            icon={Lock}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <Button variant="blue" size="lg" iconRight={ArrowRight} disabled={carregando} type="submit">
            {carregando ? 'Entrando…' : 'Entrar'}
          </Button>
          {erro && (
            <p style={{ color: 'var(--destructive)', fontSize: 12.5, textAlign: 'center', margin: 0 }}>
              Credenciais inválidas — verifique a senha de acesso.
            </p>
          )}
          <p className="muted-txt" style={{ fontSize: 12.5, textAlign: 'center', margin: 0 }}>
            {import.meta.env.VITE_API_URL
              ? 'Use a senha de acesso do painel fornecida pela equipe.'
              : 'Acesso de demonstração — qualquer e-mail e senha entram.'}
          </p>
        </form>
      </div>
      <div className="login-side">
        <div className="quote">
          <div className="q1">O diário da obra, direto do WhatsApp para o seu painel.</div>
          <div className="q2">
            Registros com foto, vínculo automático de normas, pessoas e máquinas — e alertas de conformidade em tempo
            real.
          </div>
        </div>
        <img
          className="vessel"
          src="/brand/logo-icon-192.png"
          alt=""
          style={{ width: 180, opacity: 0.18, marginBottom: '14vh' }}
        />
      </div>
    </div>
  )
}
