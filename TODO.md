# Reestruturação Completa da Arquitetura — Bykonz Marine Platform

## Contexto
Transformar o projeto na principal plataforma de gestão de mobilizações técnicas marítimas da Bykonz.
Estratégia: **criar a nova arquitetura em paralelo**, mantendo o código atual funcionando e migrando gradativamente.

Fluxo principal: Empresa → Embarcação → Mobilização → Evidências → Análise por IA → Relatório → Histórico Técnico.

---

## Progress Tracking

### Fase 0 — Fundação e Documentação de Arquitetura
- [x] Criar `docs/architecture/` com documentos de arquitetura
  - [x] `00-overview.md` — visão geral, objetivos, princípios
  - [x] `01-domain-model.md` — domínios e fluxo principal
  - [x] `02-backend-layers.md` — camadas (Controller/Service/Repository)
  - [x] `03-database.md` — modelo de dados e convenções
  - [x] `04-frontend-modules.md` — estrutura modular do frontend
  - [x] `05-ai-module.md` — módulo de IA independente
  - [x] `06-storage.md` — serviço de storage único
  - [x] `07-queues.md` — processamento assíncrono
  - [x] `08-security.md` — JWT, RBAC, auditoria
  - [x] `README.md` — índice da documentação
- [x] Definir convenção de nomenclatura e estrutura padrão de módulos

### Fase 1 — Banco de Dados (Prisma)
- [x] Criar `prisma/schema-v2.prisma` (nova arquitetura em paralelo, sem quebrar o schema atual)
- [x] Criar entidades: Company, Client, Vessel, User, RefreshToken, Mobilization, Evidence, Photo, Video, Document, Equipment, DetectedEquipment, AiAnalysis, OcrResult, TechnicalMemory, Test, PendingIssue, Diagnostic, Material, Inventory, Report, Signature
- [x] Criar entidades de infraestrutura: RefreshToken, Notification, Configuration, AuditLog, soft-delete/versionamento
- [x] Validar schema v2 com `prisma format` (sintaxe OK)
- [x] Gerar Prisma Client v2 com sucesso (schema semanticamente válido: relacionamentos + tipos)
- [ ] Unificar modelos duplicados (VesselEvidence/TechnicalEvidence, etc.) nas novas entidades
- [ ] Criar migration do schema v2 e aplicar no banco

### Fase 2 — Backend em Camadas
- [x] Criar estrutura modular em `src/modules/<dominio>/` com controller/service/repository/routes/types/validation
  - [x] Módulo `vessels` (referência) — types/repository/service/validation/routes/index
  - [ ] Módulo `mobilizations`
  - [ ] Módulo `evidences`
  - [ ] Módulo `reports`
  - [ ] Módulo `ai`
  - [ ] Módulo `users`
- [ ] Criar Storage Service único
- [ ] Criar Queue/Async Service
- [ ] Criar Auth Service com JWT + Refresh Token + RBAC

### Fase 3 — Módulo de IA Independente
- [ ] Criar `src/modules/ai/` com sub-módulos
- [ ] Abstrair modelo de IA

### Fase 4 — Frontend Modular
- [ ] Criar `frontend/src/modules/<modulo>/`
- [ ] Reformular identidade visual (offshore/naval)
- [ ] Quebrar componentes gigantes

### Fase 5 — Performance, Segurança e Testes
- [ ] Paginação, cache, lazy loading
- [ ] Refresh Token, auditoria completa
- [ ] Testes para as novas camadas

---

## Como rodar localmente
1. **Backend** (raiz `c:/bykonzRel`):
   - `npx prisma migrate deploy`
   - `npx prisma generate`
   - `npm run dev` (inicia em `http://localhost:8080`)
2. **Frontend** (`c:/bykonzRel/frontend`):
   - `pnpm install`
   - `pnpm dev` (inicia em `http://localhost:5173`)
3. **Testes:** `npm test` (suíte Vitest)

## Notas
- Novos módulos criados em paralelo não devem quebrar o código atual.
- Cada módulo possui responsabilidade única e comunicação via serviços bem definidos.
