# Frontend Modular — Bykonz Marine Platform

## 1. Estrutura por Módulos

O frontend é organizado em módulos. Cada módulo contém: `pages`, `components`, `hooks`,
`services`, `types`, `validators`.

```
frontend/src/modules/
  dashboard/
  vessels/
  mobilizations/
  equipments/
  evidences/
  reports/
  users/
  ai/
  settings/
  shared/
```

## 2. Estrutura Padrão de um Módulo

```
frontend/src/modules/
  <modulo>/
    pages/          # Páginas (rotas) do módulo
    components/     # Componentes específicos do módulo
    hooks/          # Hooks de dados/queries do módulo
    services/       # Chamadas de API do módulo
    types/          # Tipos TypeScript do módulo
    validators/     # Schemas de validação (zod)
    index.ts        # Exportações públicas
```

## 3. Princípios

1. **Não criar componentes gigantes** — quebrar em componentes reutilizáveis.
2. **Componentes reutilizáveis** — no módulo `shared`, componentes de UI genéricos.
3. **Hooks de dados** — usar TanStack Query para busca/cache/mutação.
4. **Validação** — zod para validar formulários e tipos.
5. **Serviços de API** — encapsular chamadas fetch por módulo.

## 4. Identidade Visual (Offshore/Naval)

- Visual **específico para operações marítimas**, não um "sistema de obras adaptado".
- **Embarcação** como entidade principal.
- Identidade que reflete o ambiente **offshore e naval**.
- Paleta, ícones e componentes alinhados ao contexto marítimo.

## 5. Fluxo de Trabalho no Frontend

```
Selecionar embarcação
   ↓
Criar mobilização
   ↓
Enviar fotos / vídeos / documentos
   ↓
IA analisa evidências (progresso assíncrono)
   ↓
Revisar descrições técnicas geradas pela IA
   ↓
Revisar pendências sugeridas
   ↓
Aprovar e gerar relatório
   ↓
Exportar (PDF/DOCX) e compartilhar
```

## 6. Performance

- Lazy loading de rotas/módulos
- Paginação de listas
- Cache com TanStack Query
- Upload assíncrono com progresso
