## i18n — Reuso obrigatorio de chaves de traducao

Referencia completa: `docs/i18n.md`

**NUNCA crie uma chave de traducao sem antes pesquisar nos 3 locales** (`src/lib/config/translations/pt.json`, `en.json`, `es.json`).

### Protocolo de busca (obrigatorio, antes de qualquer chave nova)

1. **Conceito exato** — grep pelo termo em portugues no `pt.json`
2. **Acoes/labels genericos** — verificar se ja existe como chave global

### Chaves globais que ja existem (use cruas, sem prefixo de feature):

- **Acoes:** `save`, `cancel`, `delete`, `edit`, `add`, `create`, `new`, `update`, `confirm`, `close`, `generate`
- **Estados:** `loading`, `error`, `success`, `empty`, `active`, `inactive`
- **Labels:** `name`, `description`, `code`, `date`, `status`, `actions`

### Quando criar chave nova

Somente se as 3 camadas de busca vierem vazias E o conceito for genuinamente novo.