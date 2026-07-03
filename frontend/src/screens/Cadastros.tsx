import { Boxes, ClipboardList, Cog, Users } from 'lucide-react'
import { Shell } from '../components/Shell'
import { Badge } from '../components/ui'

export function Cadastros() {
  return (
    <Shell titulo="Cadastros" acoes={<Badge variant="info">Próxima entrega</Badge>}>
      <p className="muted-txt" style={{ maxWidth: 560, marginTop: 0 }}>
        Mantenha o catálogo que alimenta os vínculos automáticos e os alertas. Disponível na próxima entrega desta
        fase.
      </p>
      <div className="tiles">
        <div className="tile">
          <ClipboardList aria-hidden />
          <div>
            <b>Normas</b>
            <span>Códigos, títulos e vigência por setor</span>
          </div>
        </div>
        <div className="tile">
          <Users aria-hidden />
          <div>
            <b>Pessoas &amp; competências</b>
            <span>Matrícula, status e treinamento por norma</span>
          </div>
        </div>
        <div className="tile">
          <Cog aria-hidden />
          <div>
            <b>Máquinas &amp; vistorias</b>
            <span>Checklists e validade de inspeção</span>
          </div>
        </div>
        <div className="tile">
          <Boxes aria-hidden />
          <div>
            <b>Ativos</b>
            <span>Árvore de locais e estruturas (QR na v2)</span>
          </div>
        </div>
      </div>
    </Shell>
  )
}
