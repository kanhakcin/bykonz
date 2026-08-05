# Bykonz Marine Platform — Arquitetura

Documentação de arquitetura da plataforma inteligente de gestão de mobilizações técnicas marítimas.

## Índice

| Documento | Conteúdo |
|-----------|----------|
| [00-overview.md](./00-overview.md) | Visão geral, objetivos, princípios, fluxo principal |
| [01-domain-model.md](./01-domain-model.md) | Módulos de negócio, regras de acoplamento |
| [02-backend-layers.md](./02-backend-layers.md) | Camadas do backend (Controller/Service/Repository) |
| [03-database.md](./03-database.md) | Modelo de dados, convenções, entidades |
| [04-frontend-modules.md](./04-frontend-modules.md) | Frontend modular, identidade visual offshore/naval |
| [05-ai-module.md](./05-ai-module.md) | Módulo de IA independente, abstração do modelo |
| [06-storage.md](./06-storage.md) | Storage Service único (MinIO/S3/Azure) |
| [07-queues.md](./07-queues.md) | Processamento assíncrono (filas) |
| [08-security.md](./08-security.md) | JWT, RBAC, auditoria, versionamento |

## Fluxo Principal

```
Empresa → Embarcação → Mobilização → Evidências → Análise por IA → Relatório → Histórico Técnico
```

## Estratégia

Reestruturação **em paralelo**: a nova arquitetura é criada ao lado do código atual,
com migração incremental por módulo, mantendo o sistema em produção funcionando.
