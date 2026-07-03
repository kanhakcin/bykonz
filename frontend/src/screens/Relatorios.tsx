import { CalendarRange, FileText, TriangleAlert } from 'lucide-react'
import { Shell } from '../components/Shell'
import { Badge } from '../components/ui'

export function Relatorios() {
  return (
    <Shell titulo="Relatórios" acoes={<Badge variant="info">Próxima entrega</Badge>}>
      <p className="muted-txt" style={{ maxWidth: 560, marginTop: 0 }}>
        Gere o diário em PDF por dia, obra ou unidade, com fotos, vínculos de norma e alertas do período. Disponível
        na próxima entrega.
      </p>
      <div className="tiles">
        <div className="tile">
          <FileText aria-hidden />
          <div>
            <b>Diário do dia</b>
            <span>Um dia, uma obra</span>
          </div>
        </div>
        <div className="tile">
          <CalendarRange aria-hidden />
          <div>
            <b>Por período</b>
            <span>Intervalo de datas (v1.x)</span>
          </div>
        </div>
        <div className="tile">
          <TriangleAlert aria-hidden />
          <div>
            <b>Relatório de alertas</b>
            <span>Não conformidades em aberto</span>
          </div>
        </div>
      </div>
    </Shell>
  )
}
