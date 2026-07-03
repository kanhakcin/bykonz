import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Login } from './screens/Login'
import { Painel } from './screens/Painel'
import { Cadastros } from './screens/Cadastros'
import { Relatorios } from './screens/Relatorios'
import { useAuth } from './providers'

export default function App() {
  const { usuario } = useAuth()

  if (!usuario) {
    return <Login />
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="main-scroll">
          <Routes>
            <Route path="/painel" element={<Painel />} />
            <Route path="/cadastros" element={<Cadastros />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="*" element={<Navigate to="/painel" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
