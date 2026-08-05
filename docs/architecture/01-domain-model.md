# Modelo de Domínios — Bykonz Marine Platform

## 1. Módulos de Negócio

A aplicação é organizada por módulos de negócio independentes:

| Módulo | Responsabilidade |
|--------|------------------|
| `dashboard` | Indicadores, KPIs, visão geral |
| `companies` | Empresas (multi-tenant) |
| `clients` | Clientes |
| `vessels` | Embarcações (entidade principal) |
| `mobilizations` | Mobilizações técnicas |
| `equipments` | Equipamentos |
| `evidences` | Evidências (fotos, vídeos, documentos) |
| `reports` | Relatórios técnicos |
| `documents` | Documentos |
| `ai` | Inteligência Artificial |
| `users` | Usuários e perfis |
| `settings` | Configurações |
| `integrations` | Integrações externas |
| `logs` | Logs e auditoria |
| `notifications` | Notificações |

Cada módulo possui sua própria estrutura contendo: **páginas, componentes, serviços,
validações, rotas, tipos, APIs e permissões**.

## 2. Regras de Acoplamento

- **Nenhum módulo depende diretamente de outro.**
- Toda comunicação entre módulos ocorre através de **serviços bem definidos**.
- Cada módulo tem **responsabilidade única**.

## 3. Fluxo Principal (Hierarquia)

```
Empresa → Embarcação → Mobilização → Evidências → Análise por IA → Relatório → Histórico Técnico
```

## 4. Mapamento Entidade → Módulo

| Entidade | Módulo | Domínio |
|----------|--------|---------|
| Company | companies | Empresa |
| Client | clients | Cliente |
| Vessel | vessels | Embarcação |
| Mobilization | mobilizations | Mobilização |
| Evidence | evidences | Evidência |
| Photo / Video / Document | evidences | Evidência |
| Equipment / DetectedEquipment | equipments | Equipamento |
| AiAnalysis / OcrResult | ai | Análise IA |
| Test | mobilizations | Testes |
| PendingIssue | mobilizations | Pendências |
| Diagnostic | mobilizations | Diagnóstico |
| Material / Inventory | mobilizations | Material/Inventário |
| Report / Signature | reports | Relatório |
| RefreshToken / Notification | users / notifications | Infraestrutura |
| Configuration | settings | Configuração |
| AuditLog | logs | Auditoria |
