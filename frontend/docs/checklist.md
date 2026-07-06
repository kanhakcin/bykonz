# Checklist de Nova Feature

Use este checklist ao finalizar qualquer criacao ou modificacao significativa.

## 1. Estrutura de Pastas

- [ ] Pasta criada em `src/routes/_private/{feature}/`
- [ ] `index.tsx` existe (pagina principal)
- [ ] `add/index.tsx` existe (formulario, se necessario)
- [ ] `@interface/{feature}.interface.ts` criado (schema + types)
- [ ] `@hooks/use-{feature}-form.ts` criado (se tem formulario)
- [ ] `@components/{feature}-form.tsx` criado (se tem formulario)
- [ ] `@consts/{feature}.consts.ts` criado (se tem enums/configs)

## 2. Hook de API

- [ ] Verificado se ja existe em `src/hooks/`
- [ ] Se nao existia, criado em `src/hooks/use-{feature}-api.ts`
- [ ] Query keys centralizadas com hierarquia
- [ ] Mutations com `invalidateQueries` no `onSuccess`

## 3. Internacionalizacao (i18n)

- [ ] Todas as strings de UI usando `t('chave')`
- [ ] Antes de criar chave nova: grep por conceito + sinonimos nos 3 locales (reuse > criar)
- [ ] Acoes/labels globais (`save`, `new`, `description`...) usadas cruas, sem prefixo de feature
- [ ] Chaves novas com 2-3 segmentos no maximo, baseadas em conceito (nao na posicao na UI)
- [ ] Separador `.` apenas (nunca `-` ou `_`)
- [ ] Chaves adicionadas em `pt.json`, `en.json` e `es.json` na mesma edicao

Detalhamento: [`i18n.md`](./i18n.md)

## 4. Componentes e Padroes

- [ ] Paginas usam `Card > CardHeader > CardContent > CardFooter`
- [ ] Componentes comuns usam `Item`, `ItemTitle`, `ItemDescription` (nunca Card)
- [ ] Loading usa `<DefaultLoading />`
- [ ] Dados vazios usam `<DefaultEmptyData />`
- [ ] Formularios usam `<DefaultFormLayout />`
- [ ] Selects reutilizam componentes de `src/components/selects/`

## 5. Datas e Estado

- [ ] Datas formatadas com `@/lib/formatDate` (nunca date-fns direto)
- [ ] Estado persistente com Zustand `persist` (nunca localStorage direto)

## 6. Roteamento

- [ ] Sem `.` ou `$` em nomes de arquivos de rota
- [ ] IDs dinamicos via Search Params (nunca `$id`)
- [ ] Cada sub-rota e uma pasta com `index.tsx`
- [ ] `index.tsx` hub do modulo pai atualizado com o novo item de menu (ou criado se modulo novo)
- [ ] `staticData.relatedRoutes` do hub inclui a nova sub-rota
- [ ] `staticData.capabilities` do hub menciona a nova capability

## 7. Graficos (se aplicavel)

- [ ] Cores com `getChartColor(index)` (nunca cores hardcoded)
- [ ] Sem `mx-auto` no `ChartContainer`
- [ ] Wrapper e `Item` (nunca `Card`)

## 8. Antes de Commitar

```bash
pnpm run format  # Biome
pnpm run check   # TypeScript
```
